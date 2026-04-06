// Triple J Corp. Logo — three interlocking angular J marks
// Left J = steel blue, Right J = teal, Bottom J = gold

export default function TripleJLogo({ size = 80 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ── LEFT J (steel blue) ── angled to the right */}
      {/* top horizontal bar */}
      <polygon points="10,18 38,18 34,30 6,30" fill="#7a9dbf" />
      {/* vertical stem */}
      <polygon points="26,30 34,30 30,62 22,62" fill="#5a80a8" />
      {/* foot curving left-down */}
      <polygon points="10,55 30,55 26,67 6,67" fill="#4a6f95" />

      {/* ── RIGHT J (teal) ── mirror of left */}
      {/* top horizontal bar */}
      <polygon points="62,18 90,18 94,30 66,30" fill="#6bbedd" />
      {/* vertical stem */}
      <polygon points="66,30 74,30 78,62 70,62" fill="#4a9cc7" />
      {/* foot curving right-down */}
      <polygon points="70,55 90,55 94,67 74,67" fill="#3585b0" />

      {/* ── BOTTOM J (gold) ── centered, pointing down */}
      {/* top horizontal bar */}
      <polygon points="34,52 66,52 63,62 37,62" fill="#e0c050" />
      {/* vertical stem */}
      <polygon points="46,62 54,62 51,88 43,88" fill="#c9a227" />
      {/* foot */}
      <polygon points="32,80 51,80 48,92 29,92" fill="#a88318" />
    </svg>
  );
}
