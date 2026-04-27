type Props = {
  videoUrl: string;
  onDismiss: () => void;
};

export function ScreensaverOverlay({ videoUrl, onDismiss }: Props) {
  return (
    <div className="screensaver-overlay" onPointerDown={onDismiss}>
      <video
        className="screensaver-overlay__video"
        src={videoUrl}
        autoPlay
        loop
        muted
        playsInline
      />
    </div>
  );
}
