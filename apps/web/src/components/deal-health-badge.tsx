"use client";

interface DealHealthBadgeProps {
  score: number;
  issues?: string[];
  size?: "sm" | "md";
}

export function DealHealthBadge({ score, issues = [], size = "sm" }: DealHealthBadgeProps) {
  const color = score >= 80 ? "text-green-600 bg-green-50 border-green-200"
    : score >= 50 ? "text-amber-600 bg-amber-50 border-amber-200"
    : "text-red-600 bg-red-50 border-red-200";

  const ringColor = score >= 80 ? "stroke-green-500"
    : score >= 50 ? "stroke-amber-500"
    : "stroke-red-500";

  const dim = size === "sm" ? 28 : 36;
  const strokeWidth = size === "sm" ? 3 : 3.5;
  const radius = (dim - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative group">
      <div className={`inline-flex items-center justify-center rounded-full border ${color}`} style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} className="absolute inset-0 -rotate-90">
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-200"
          />
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={ringColor}
          />
        </svg>
        <span className={`relative text-[${size === "sm" ? "10" : "11"}px] font-bold`}>{score}</span>
      </div>
      {issues.length > 0 && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-48 bg-slate-900 text-white text-[10px] rounded-lg p-2 shadow-lg">
          {issues.map((issue, i) => (
            <p key={i} className="py-0.5">{issue}</p>
          ))}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
}
