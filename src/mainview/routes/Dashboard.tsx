import React, { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Settings,
  Power,
  Sun,
  Wifi,
  BatteryFull,
  Gamepad2,
  Bluetooth,
  Settings2,
  Bell,
  HardDrive,
} from "lucide-react";
import { createFileRoute, Link, linkOptions } from "@tanstack/react-router";
import "gamepad.css/styles.min.css";
import GamepadIcon from "../components/GamepadIcon";
import Clock from "../components/Clock";
import classNames from "classnames";

export const Route = createFileRoute("/Dashboard")({
  component: ConsoleHomeUI,
});

const games = [
  {
    title: "The Legend of Zelda",
    subtitle: "Link's Awakening",
  },
  {
    title: "Captain Toad",
    subtitle: "Treasure Tracker",
    focused: true,
  },
  {
    title: "Crash Bandicoot",
    subtitle: "N. Sane Trilogy",
  },
  {
    title: "Super Mario",
    subtitle: "Odyssey",
  },
  {
    title: "Animal Crossing",
    subtitle: "New Horizons",
  },
];

export default function ConsoleHomeUI() {
  const [focus, setFocus] = useState(1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight")
        setFocus((i) => Math.min(i + 1, games.length - 1));
      if (e.key === "ArrowLeft") setFocus((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden justify-around"
      style={{
        background: `linear-gradient(
      color-mix(in srgb, var(--color-dark) 60%, transparent), 
      color-mix(in srgb, var(--color-dark) 60%, transparent)
    ), url(https://picsum.photos/id/${10 + focus}/1920/1080.webp?blur=10)`,
        backgroundSize: "cover",
      }}
    >
      {/* Top bar */}
      <header className="h-14 px-6 mt-2 flex items-center justify-between text-white">
        <div className="flex items-center gap-3 drop-shadow-sm">
          <div className="w-16 h-16 rounded-full bg-alert" />
          <div className="w-16 h-16 rounded-full bg-cyan-500 ring-4 ring-primary" />
          <button className="w-16 h-16 rounded-full bg-dark flex items-center justify-center">
            <Plus className="w-8 h-8" />
          </button>
        </div>

        <div className="flex items-center gap-5 text drop-shadow-sm">
          <Clock />
          <Wifi className="w-6 h-6" />
          <Bluetooth className="w-6 h-6" />
          <Bell className="w-6 h-6" />
          <div className="flex gap-2 items-center">
            <BatteryFull className="w-6 h-6" />
            <span className="font-semibold">100%</span>
          </div>
          <div className="flex gap-2">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-dark bg-white">
              <Sun className="w-8 h-8" />
            </div>
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-dark bg-white">
              <Power className="w-8 h-8" />
            </div>
          </div>
        </div>
      </header>

      {/* Filter bar */}
      <div className="flex items-center justify-center px-8 gap-2 py-3 drop-shadow-sm">
        <button className="flex w-14 h-14 items-center justify-center bg-dark rounded-full text-white">
          <Settings2 className="w-5 h-5" />
        </button>
        <div className="flex bg-dark rounded-full p-1">
          <button className="px-4 h-12 rounded-full text-white/70">All</button>
          <button className="px-4 h-12 rounded-full bg-primary drop-shadow-sm text-black font-bold">
            Digital
          </button>
          <button className="px-4 h-12 rounded-full text-white/70">
            Physical
          </button>
        </div>
        <button className="flex w-14 h-14 items-center justify-center bg-dark rounded-full text-white">
          <Search className="w-5 h-5" />
        </button>
      </div>

      {/* Game carousel */}
      <main
        className="flex w-full px-8 py-4 overflow-x-scroll items-center gap-6"
        style={{ scrollbarWidth: "none" }}
      >
        {games.map((g, i) => {
          const focused = i === focus;
          return (
            <div
              key={g.title}
              className={classNames(
                `min-w-64 h-82 rounded-2xl bg-dark flex flex-col justify-end overflow-hidden transition-all duration-200 drop-shadow-md`,
                {
                  "ring-7 ring-primary scale-105": focused,
                  "drop-shadow-lg": focused,
                },
              )}
            >
              <div
                className="flex-1 bg-white p-4"
                style={{
                  backgroundImage: `url(https://picsum.photos/id/${10 + i}/300/300.webp)`,
                }}
              ></div>
              <div className="h-0 flex pr-2 justify-end items-center">
                <div className="flex rounded-full bg-white w-10 h-10 justify-center items-center text-dark drop-shadow-sm">
                  <HardDrive className="w-6 h-6" />
                </div>
              </div>
              <div className="flex flex-col p-4 pt-6 text-light2">
                <div className="text-xl font-bold">{g.title}</div>
                <div className="text-s">{g.subtitle}</div>
              </div>
            </div>
          );
        })}
      </main>

      {/* Menu */}

      <div className="flex w-full items-center justify-center gap-3">
        <CircleIcon
          to={linkOptions({
            to: "/Dashboard",
          })}
          label="Home"
          active
        />
        <CircleIcon label="News" />
        <CircleIcon label="Shop" />
        <CircleIcon label="Album" />
        <CircleIcon label="Controllers" />
        <CircleIcon label="Settings" highlight />
        <span className="flex items-center rounded-full bg-primary text-dark px-4 py-2 font-semibold">
          Settings
        </span>
      </div>

      {/* Bottom bar */}
      <footer className="px-8 flex flex-col items-center justify-between text-light2">
        <div className="flex gap-2 text-sm text-light2">
          <span className="flex gap-2 bg-dark pl-2 pr-3 py-1.5 rounded-full items-center text-lg font-semibold drop-shadow-sm">
            <GamepadIcon platform="xbox" variant="one" button="a" text="a" />
            Continue
          </span>
          <span className="flex gap-2 bg-dark pl-2 pr-3 py-1.5 rounded-full items-center text-lg font-semibold drop-shadow-sm">
            <GamepadIcon platform="xbox" variant="one" button="b" text="b" />
            Back
          </span>
          <span className="flex gap-2 bg-dark pl-2 pr-3 py-1.5 rounded-full items-center text-lg font-semibold drop-shadow-sm">
            <GamepadIcon platform="xbox" variant="one" button="x" text="x" />
            Close
          </span>
          <span className="flex gap-2 bg-dark pl-2 pr-3 py-1.5 rounded-full items-center text-lg font-semibold drop-shadow-sm">
            <GamepadIcon platform="xbox" variant="one" button="y" text="y" />
            Options
          </span>
        </div>
      </footer>
    </div>
  );
}

function CircleIcon({
  to,
  active,
  highlight,
}: {
  to?: any;
  active?: boolean;
  highlight?: boolean;
  label?: string;
}) {
  return (
    <Link
      {...to}
      className={`w-20 h-20 rounded-full flex items-center justify-center text-dark drop-shadow-lg
      ${highlight === true ? "bg-primary" : active === true ? "bg-alert text-white" : "bg-white"}`}
    >
      <Gamepad2 className="w-10 h-10" />
    </Link>
  );
}
