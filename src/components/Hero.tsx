"use client";

import React, { useState, useEffect } from "react";import Image from 'next/image';
import Link from 'next/link';
const Hero = () => {
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<"hacker" | "judge" | null>(null);
	const [honeypot, setHoneypot] = useState(""); // Honeypot field for spam detection
	const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
	const [message, setMessage] = useState("");
	const [formLoadTime, setFormLoadTime] = useState<number>(0);
	const [cooldownUntil, setCooldownUntil] = useState<number>(0);

	// Track when form was loaded (for timing analysis)
	useEffect(() => {
		setFormLoadTime(Date.now());

		// Check if there's an active cooldown
		const savedCooldown = sessionStorage.getItem("subscription_cooldown");
		if (savedCooldown) {
			const cooldown = parseInt(savedCooldown, 10);
			if (cooldown > Date.now()) {
				setCooldownUntil(cooldown);
			} else {
				sessionStorage.removeItem("subscription_cooldown");
			}
		}
	}, []);

	// Update cooldown timer
	useEffect(() => {
		if (cooldownUntil <= Date.now()) return;

		const timer = setInterval(() => {
			if (Date.now() >= cooldownUntil) {
				setCooldownUntil(0);
				sessionStorage.removeItem("subscription_cooldown");
			}
		}, 1000);

		return () => clearInterval(timer);
	}, [cooldownUntil]);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		// Check cooldown
		if (cooldownUntil > Date.now()) {
			const remainingSeconds = Math.ceil((cooldownUntil - Date.now()) / 1000);
			setStatus("error");
			setMessage(`Please wait ${remainingSeconds} seconds before trying again`);
			return;
		}

		// Basic client-side email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			setStatus("error");
			setMessage("Please enter a valid email address");
			return;
		}

		if (!role) {
			setStatus("error");
			setMessage("Please select whether you're a hacker or a judge");
			return;
		}

		setStatus("loading");
		setMessage("");

		try {
			const response = await fetch("/api/subscribe", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email,
					role,
					honeypot, // Include honeypot (should be empty)
					source: "homepage",
					timestamp: formLoadTime,
				}),
			});

			const data = await response.json();

			if (data.success) {
				setStatus("success");
				setMessage(data.message || "Thanks for subscribing! We'll keep you updated.");
				setEmail("");
				setRole(null);

				// Set 60-second cooldown
				const cooldown = Date.now() + 60000;
				setCooldownUntil(cooldown);
				sessionStorage.setItem("subscription_cooldown", cooldown.toString());

				// Reset success message after 10 seconds
				setTimeout(() => {
					setStatus("idle");
					setMessage("");
				}, 10000);
			} else {
				setStatus("error");
				setMessage(data.message || "Something went wrong. Please try again.");

				// Reset error message after 5 seconds
				setTimeout(() => {
					setStatus("idle");
					setMessage("");
				}, 5000);
			}
		} catch (error) {
			console.error("Subscription error:", error);
			setStatus("error");
			setMessage("Unable to connect. Please try again later.");

			// Reset error message after 5 seconds
			setTimeout(() => {
				setStatus("idle");
				setMessage("");
			}, 5000);
		}
	};

	const isLoading = status === "loading";
	const isCooldown = cooldownUntil > Date.now();
	const isDisabled = isLoading || isCooldown;

	// Split screen layout: Clean content on left, full image on right
	return (
		<section className="flex flex-col lg:flex-row min-h-screen w-full relative">
			{/* Logo - Positioned top-left on large screens, centered top on mobile */}
			<div className="absolute top-6 left-6 lg:top-12 lg:left-12 z-20">
				<Link href="/" className="block hover:opacity-80 transition-opacity duration-300">
					<div className="relative w-12 h-12 lg:w-16 lg:h-16">
						<Image src="/gdg-logo.jpg" alt="GDGHacks Logo" fill className="object-contain" />
					</div>
				</Link>
			</div>

			{/* Left Column: Clean Content */}
			<div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 md:px-16 lg:px-20 xl:px-24 py-20 lg:py-0 bg-white relative z-10 order-2 lg:order-1 shadow-2xl lg:shadow-none">
				<div className="max-w-xl mx-auto lg:mx-0 flex flex-col items-start">
					
					{/* Coming Soon Badge */}
					<div className="mb-6 lg:mb-8">
						<div className="px-4 py-1.5 text-xs font-extrabold text-blue-600 bg-blue-50 border border-blue-100 rounded-full tracking-widest uppercase">Coming Soon</div>
					</div>

					{/* Main Heading Group */}
					<div className="mb-10 lg:mb-12">
						<h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-7xl xl:text-8xl font-black tracking-tighter leading-[0.9] text-slate-900 pb-2 -ml-[0.05em]">
							GDGHacks
							<br />
							<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-400 inline-block pb-2 pr-2">2026</span>
						</h1>
						
						{/* Description with left border */}
						<div className="mt-6 lg:mt-8 pt-2 border-l-4 border-slate-100 pl-6 flex flex-col gap-3">
							<p className="text-xl md:text-2xl text-slate-900 font-bold leading-tight">Guelph's In-Person Hackathon.</p>
							<p className="text-lg text-slate-500 font-medium max-w-md leading-relaxed">Join 500+ innovators to build, learn, and connect.</p>
						</div>
					</div>

					{/* Mailing List Form Section */}
					<div className="w-full">
						<p className="text-sm uppercase tracking-wider text-slate-400 font-bold mb-4 pl-1">Get notified when applications open</p>

						<form onSubmit={handleSubmit} className="space-y-4">
							{/* Role selector */}
							<div className="flex gap-3">
								<button
									type="button"
									onClick={() => setRole("hacker")}
									className={`flex-1 py-3 px-4 rounded-2xl text-sm font-bold border-2 transition-all duration-200 ${
										role === "hacker"
											? "bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-200"
											: "bg-white border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700"
									}`}
								>
									I'm a Hacker
								</button>
								<button
									type="button"
									onClick={() => setRole("judge")}
									className={`flex-1 py-3 px-4 rounded-2xl text-sm font-bold border-2 transition-all duration-200 ${
										role === "judge"
											? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200"
											: "bg-white border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700"
									}`}
								>
									I'm a Judge
								</button>
							</div>

							{/* Honeypot field - hidden from users, only bots fill it */}
							<input
								type="text"
								name="website"
								value={honeypot}
								onChange={(e) => setHoneypot(e.target.value)}
								tabIndex={-1}
								autoComplete="off"
								aria-hidden="true"
								style={{
									position: "absolute",
									left: "-9999px",
									width: "1px",
									height: "1px",
									opacity: 0,
								}}
							/>

							<div className="flex flex-col sm:flex-row gap-3">
								<input
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="Enter your email address"
									className="flex-1 px-5 py-4 text-base rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-50 focus:outline-none transition-all duration-300 placeholder:text-slate-400 font-medium text-slate-900"
									required
									disabled={isDisabled}
								/>
								<button
									type="submit"
									disabled={isDisabled}
									className="group px-8 py-4 text-base font-bold text-white bg-slate-900 rounded-2xl hover:bg-blue-600 focus:ring-4 focus:ring-slate-200 transition-all duration-300 shadow-lg shadow-slate-200 hover:shadow-blue-200 whitespace-nowrap disabled:opacity-70 disabled:hover:bg-slate-900 flex items-center justify-center"
								>
									{isLoading ? (
										<span className="flex items-center justify-center gap-2">
											<svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
												<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
												<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
											</svg>
											<span>Subscribing...</span>
										</span>
									) : isCooldown ? (
										`Wait ${Math.ceil((cooldownUntil - Date.now()) / 1000)}s`
									) : (
										<span className="flex items-center gap-2">
											Notify Me 
											<svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
										</span>
									)}
								</button>
							</div>

							{status !== "idle" && status !== "loading" && (
								<div className={`text-sm font-bold pl-1 ${status === "success" ? "text-green-600" : "text-red-600"}`}>
									{status === "success" && (
										<div className="flex items-center gap-2">
											<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
												<path
													fillRule="evenodd"
													d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
													clipRule="evenodd"
												/>
											</svg>
											<span>{message}</span>
										</div>
									)}
									{status === "error" && (
										<div className="flex items-center gap-2">
											<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
												<path
													fillRule="evenodd"
													d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
													clipRule="evenodd"
												/>
											</svg>
											<span>{message}</span>
										</div>
									)}
								</div>
							)}
						</form>

						<p className="text-xs text-slate-500 font-medium mt-4">We'll send you updates about GDGHacks 2026. No spam, unsubscribe anytime.</p>
					</div>
				</div>
			</div>

			{/* Right Column: Image */}
			<div className="w-full lg:w-1/2 min-h-[40vh] lg:min-h-screen relative bg-blue-50 order-1 lg:order-2">
				<img src="/gdg-background.webp" alt="GDGHacks Background" className="absolute inset-0 w-full h-full object-cover" />
			</div>
		</section>
	);
};

export default Hero;
