import InteractiveDotGrid from "@/components/InteractiveDotGrid/InteractiveDotGrid";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";

export default function Home() {
  return (
    <div
      className="relative w-full h-screen overflow-hidden bg-white"
      style={{
        backgroundImage: "url('/gdg-background.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <Navbar />
      <div className="absolute inset-0 z-0">
        <InteractiveDotGrid
          gap={15}
          dotRadius={2}
          backgroundColor="transparent"
        />
      </div>
      <Hero />
    </div>
  );
}
