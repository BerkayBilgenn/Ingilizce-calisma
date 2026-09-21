import type { CSSProperties } from "react";

export default function StarField() {
  return <div className="star-field" aria-hidden="true">
    {Array.from({ length: 18 }, (_, index) => <i key={index} style={{ "--star": index } as CSSProperties}>★</i>)}
  </div>;
}
