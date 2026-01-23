import React from "react";

export default function GamepadIcon({
  platform,
  variant,
  button,
  text,
}: {
  platform: "xbox" | "playstation" | "nintendo";
  variant: string;
  button: string;
  text?: string;
}) {
  return (
    <div className="gamepad-button-wrapper">
      <i
        className={`gamepad-button gamepad-button-${platform} gamepad-button-${platform}--${button} gamepad-button-${platform}--variant-${variant}`}
      >
        {text}
      </i>
    </div>
  );
}
