// @ts-nocheck
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import React from "react";
import "../home/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Kroaddy - New Home",
    description: "AI Travel Assistant",
};

export default function NewHomeLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className={inter.className}>
            {children}
        </div>
    );
}

