import Link from 'next/link';
import Image from 'next/image';
import React from 'react';

const Navbar = () => {
    return (
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center px-8 py-6 bg-transparent pointer-events-none">
            <div className="pointer-events-auto">
                <Link href="/" className="block hover:opacity-80 transition-opacity duration-300">
                    <div className="relative w-16 h-16">
                        <Image
                            src="/gdg-logo.jpg"
                            alt="GDGHacks Logo"
                            fill
                            className="object-contain"
                        />
                    </div>
                </Link>
            </div>
        </nav>
    );
};

export default Navbar;
