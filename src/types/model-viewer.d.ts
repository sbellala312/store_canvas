declare namespace JSX {
  interface IntrinsicElements {
    "model-viewer": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string;
        alt?: string;
        "camera-controls"?: boolean | "";
        "auto-rotate"?: boolean | "";
        "auto-rotate-delay"?: number | string;
        "rotation-per-second"?: string;
        "shadow-intensity"?: number | string;
        "environment-image"?: string;
        exposure?: number | string;
        ar?: boolean | "";
        "ar-modes"?: string;
        loading?: string;
        style?: React.CSSProperties;
      },
      HTMLElement
    >;
  }
}
