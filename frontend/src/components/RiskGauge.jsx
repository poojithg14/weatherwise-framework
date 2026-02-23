import React, { useMemo } from 'react';

const GAUGE_WIDTH = 120;
const GAUGE_HEIGHT = 80;
const RADIUS = 48;
const CENTER_X = 60;
const CENTER_Y = 62;
const STROKE_WIDTH = 10;

function getTierLabel(score) {
  if (score < 30) return 'LOW';
  if (score < 70) return 'ELEVATED';
  return 'EXTREME';
}

function getTierColor(score) {
  if (score < 30) return '#2E7D32';
  if (score < 70) return '#F9A825';
  return '#D32F2F';
}

function getGlowColor(score) {
  if (score < 30) return 'rgba(46, 125, 50, 0.4)';
  if (score < 70) return 'rgba(249, 168, 37, 0.4)';
  return 'rgba(211, 47, 47, 0.5)';
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const startRad = (Math.PI * startAngle) / 180;
  const endRad = (Math.PI * endAngle) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

export default function RiskGauge({ score = 0 }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const tierLabel = getTierLabel(clampedScore);
  const tierColor = getTierColor(clampedScore);
  const glowColor = getGlowColor(clampedScore);

  // Arc goes from 180 degrees (left) to 0 degrees (right) -- a semicircle
  // Score of 0 = 180 degrees, score of 100 = 0 degrees
  const needleAngle = 180 - (clampedScore / 100) * 180;
  const needleRad = (Math.PI * needleAngle) / 180;
  const needleX = CENTER_X + (RADIUS - 8) * Math.cos(needleRad);
  const needleY = CENTER_Y + (RADIUS - 8) * Math.sin(needleRad);

  const backgroundArc = describeArc(CENTER_X, CENTER_Y, RADIUS, 180, 360);
  const greenArc = describeArc(CENTER_X, CENTER_Y, RADIUS, 180, 234); // 0-30%
  const yellowArc = describeArc(CENTER_X, CENTER_Y, RADIUS, 234, 306); // 30-70%
  const redArc = describeArc(CENTER_X, CENTER_Y, RADIUS, 306, 360); // 70-100%

  // Score arc: from 180 to (180 + score * 1.8)
  const scoreEndAngle = 180 + (clampedScore / 100) * 180;
  const scoreArc = describeArc(CENTER_X, CENTER_Y, RADIUS, 180, Math.min(scoreEndAngle, 360));

  return (
    <div
      className="relative flex flex-col items-center justify-center"
      style={{
        width: GAUGE_WIDTH,
        height: GAUGE_HEIGHT,
        background: 'rgba(13, 17, 23, 0.85)',
        borderRadius: '12px',
        border: `1px solid ${tierColor}40`,
        boxShadow: `0 0 12px ${glowColor}`,
      }}
      aria-label={`Risk score: ${clampedScore} out of 100. Level: ${tierLabel}`}
    >
      <svg
        width={GAUGE_WIDTH}
        height={56}
        viewBox={`0 0 ${GAUGE_WIDTH} 70`}
        style={{ marginTop: '-2px' }}
      >
        {/* Background track */}
        <path
          d={backgroundArc}
          fill="none"
          stroke="#30363d"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
        />

        {/* Green zone */}
        <path
          d={greenArc}
          fill="none"
          stroke="#2E7D32"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="butt"
          opacity={0.5}
        />

        {/* Yellow zone */}
        <path
          d={yellowArc}
          fill="none"
          stroke="#F9A825"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="butt"
          opacity={0.5}
        />

        {/* Red zone */}
        <path
          d={redArc}
          fill="none"
          stroke="#D32F2F"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="butt"
          opacity={0.5}
        />

        {/* Active score arc */}
        <path
          d={scoreArc}
          fill="none"
          stroke={tierColor}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          className="transition-risk"
          style={{
            filter: `drop-shadow(0 0 4px ${tierColor})`,
          }}
        />

        {/* Needle */}
        <line
          x1={CENTER_X}
          y1={CENTER_Y}
          x2={needleX}
          y2={needleY}
          stroke="#ffffff"
          strokeWidth={2}
          strokeLinecap="round"
          className="transition-risk"
        />
        <circle cx={CENTER_X} cy={CENTER_Y} r={3} fill="#ffffff" />

        {/* Score number */}
        <text
          x={CENTER_X}
          y={CENTER_Y - 8}
          textAnchor="middle"
          fill={tierColor}
          fontSize="18"
          fontWeight="bold"
          className="transition-risk"
        >
          {clampedScore}
        </text>
      </svg>

      {/* Tier label */}
      <div
        className="text-xs font-bold tracking-wider transition-risk"
        style={{
          color: tierColor,
          marginTop: '-8px',
        }}
      >
        {tierLabel}
      </div>
    </div>
  );
}
