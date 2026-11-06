// The Toreto mark, from the channel intro's vector: the T and its orbit swoosh.
export default function Mark({ className, ring }: { className?: string; ring?: boolean }) {
  return (
    <svg className={className} viewBox="-20 40 800 520" aria-hidden="true">
      {ring && <circle cx="365" cy="300" r="350" fill="none" stroke="currentColor" strokeWidth="5" opacity=".7" />}
      <g fill="currentColor">
        <polygon points="125,85 632,85 562,174 48,174" />
        <polygon points="248,184 305,176 410,176 228,350" opacity=".9" />
        <polygon points="388,210 365,402 228,492 240,362" opacity=".78" />
        <path d="M135,322 C70,350 5,385 7,415 C9,440 80,432 150,412 C300,370 480,295 620,228 C700,190 750,165 746,138 C743,125 690,122 635,128 C680,128 722,130 720,146 C716,170 640,208 560,246 C430,305 300,350 190,385 C110,408 40,418 35,402 C30,385 80,350 135,322 Z" />
      </g>
    </svg>
  );
}
