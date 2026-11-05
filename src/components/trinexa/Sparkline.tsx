import { Area, AreaChart, ResponsiveContainer } from "recharts";

export const Sparkline = ({ data, color = "#00e673" }: { data: { x: number; y: number }[]; color?: string }) => {
  // SVG gradients fail when using URLs with complex characters like (#) or hsl(), creating a safe ID
  const cleanId = color.replace(/[^a-zA-Z0-9]/g, '');
  
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`grad-${cleanId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.6} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="y" stroke={color} strokeWidth={2} fill={`url(#grad-${cleanId})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
};
