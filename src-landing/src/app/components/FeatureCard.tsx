interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
  highlight?: boolean;
}

export function FeatureCard({ icon, title, description, highlight = false }: FeatureCardProps) {
  return (
    <div
      className={`group relative bg-white/5 backdrop-blur-sm border rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
        highlight
          ? "border-violet-500/50 hover:border-violet-500 shadow-violet-500/10"
          : "border-white/10 hover:border-white/20 hover:shadow-violet-500/5"
      }`}
    >
      {/* Gradient accent - full border for highlight, left edge for others */}
      {highlight ? (
        <>
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute top-3 right-3">
            <span className="text-xs px-2 py-1 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
              Safety First 🔍
            </span>
          </div>
        </>
      ) : (
        <div className="absolute left-0 top-6 bottom-6 w-1 bg-gradient-to-b from-violet-500 to-fuchsia-500 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      )}

      <div className="relative">
        <div className="text-4xl mb-4">{icon}</div>
        <h3
          className="text-xl font-semibold text-white mb-3"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {title}
        </h3>
        <p
          className="text-white/60 leading-relaxed"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {description}
        </p>
      </div>
    </div>
  );
}
