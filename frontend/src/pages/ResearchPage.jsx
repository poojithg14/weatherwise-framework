export default function ResearchPage() {
  return (
    <div className="min-h-screen bg-ww-dark pt-14 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-16">

        {/* ── Page Header ── */}
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
            Research &amp; Technology
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Technical foundations of the WeatherWise framework — from peer-reviewed evaluation
            results to system architecture and ML pipeline details.
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            Section A — National Impact (EB2-NIW angle)
        ═══════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeading title="National Impact" subtitle="Why this matters" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <ImpactCard value="~6,000" label="Annual Weather Fatalities" color="red" />
            <ImpactCard value="~1.2M" label="Weather-Related Crashes" color="orange" />
            <ImpactCard value="$42B" label="Annual Economic Cost" color="yellow" />
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Weather contributes to approximately 21% of all vehicle crashes in the United States.
            The Federal Highway Administration (FHWA) reports that adverse weather conditions —
            including rain, snow, fog, and severe storms — create hazardous driving conditions
            that disproportionately affect highway travelers on long-distance corridors.
          </p>
          <p className="text-gray-500 text-xs mt-3">
            Sources: FHWA Road Weather Management Program, NHTSA Fatality Analysis, AAA Foundation for Traffic Safety
          </p>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            Section B — System Architecture
        ═══════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeading title="System Architecture" subtitle="4-layer pipeline" />

          <div className="space-y-3 mb-8">
            <PipelineCard
              step="1"
              title="Data Ingestion"
              description="Real-time polling of NWS Alert API, NOAA Storm Events database, and OSRM routing engine for corridor geometry."
              color="blue"
            />
            <PipelineArrow />
            <PipelineCard
              step="2"
              title="Risk Assessment"
              description="XGBoost gradient-boosted model with 5-component risk scoring: proximity, intersection, severity, exposure window, and escape difficulty."
              color="purple"
            />
            <PipelineArrow />
            <PipelineCard
              step="3"
              title="Alert Generation"
              description="4-tier classification system (CLEAR → WATCH → WARNING → CRITICAL) with GraphQL subscriptions for real-time push delivery."
              color="orange"
            />
            <PipelineArrow />
            <PipelineCard
              step="4"
              title="User Interface"
              description="Interactive Leaflet map with real-time hazard overlays, audio alerts, danger zone visualization, and dynamic rerouting suggestions."
              color="cyan"
            />
          </div>

          {/* Tech Stack Pills */}
          <div className="flex flex-wrap gap-2 mb-6">
            {['Spring Boot 3.3.5', 'Netflix DGS GraphQL', 'PostGIS', 'XGBoost', 'React 18', 'Leaflet', 'WebSocket', 'OSRM'].map((tech) => (
              <span key={tech} className="px-3 py-1 rounded-full text-xs font-medium bg-ww-surface border border-ww-border text-gray-300">
                {tech}
              </span>
            ))}
          </div>

          <div className="bg-ww-surface border border-ww-border rounded-xl p-4">
            <h4 className="text-white font-semibold text-sm mb-2">CWAM Adaptation: Aviation → Highway</h4>
            <p className="text-gray-400 text-xs leading-relaxed">
              WeatherWise adapts MIT Lincoln Laboratory&apos;s Corridor Integrated Weather System (CIWS) and
              Corridor Weather Avoidance Model (CWAM) — originally designed for en-route airspace management —
              to the surface transportation domain. Key adaptations include replacing flight-level corridor
              definitions with highway segment geometries, substituting aviation-specific hazard thresholds
              with road-surface and visibility parameters, and introducing driver-actionable alert tiers
              calibrated for highway decision-making timescales.
            </p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            Section C — ML Pipeline
        ═══════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeading title="ML Pipeline" subtitle="Multi-hazard classification" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Training Data */}
            <div className="bg-ww-surface border border-ww-border rounded-xl p-5">
              <h4 className="text-white font-semibold text-sm mb-3">Training Data</h4>
              <div className="space-y-2 text-sm">
                <DataRow label="Source" value="NOAA Storm Events Database" />
                <DataRow label="Records" value="315,217" />
                <DataRow label="Features" value="20 engineered features" />
                <DataRow label="Period" value="2006–2024" />
                <DataRow label="Hazard Types" value="6 classes" />
              </div>
            </div>

            {/* Model Performance */}
            <div className="bg-ww-surface border border-ww-border rounded-xl p-5">
              <h4 className="text-white font-semibold text-sm mb-3">Model Performance</h4>
              <div className="text-center mb-3">
                <span className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                  99.57%
                </span>
                <span className="text-gray-400 text-sm ml-2">Overall Accuracy</span>
              </div>
              <div className="space-y-2 text-sm">
                <DataRow label="Model" value="XGBoost Gradient Boosted" />
                <DataRow label="Validation" value="5-fold Cross Validation" />
                <DataRow label="Macro F1" value="97.82%" />
              </div>
            </div>
          </div>

          {/* Per-class metrics table */}
          <div className="overflow-x-auto rounded-xl border border-ww-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ww-surface text-gray-400 text-xs">
                  <th className="text-left px-4 py-3 font-medium">Hazard Type</th>
                  <th className="text-right px-4 py-3 font-medium">Precision</th>
                  <th className="text-right px-4 py-3 font-medium">Recall</th>
                  <th className="text-right px-4 py-3 font-medium">F1</th>
                  <th className="text-right px-4 py-3 font-medium">AUC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ww-border">
                {ML_METRICS.map((m) => (
                  <tr key={m.type} className="text-gray-300 hover:bg-ww-surface/50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-white">{m.type}</td>
                    <td className="text-right px-4 py-2.5">{m.precision}%</td>
                    <td className="text-right px-4 py-2.5">{m.recall}%</td>
                    <td className="text-right px-4 py-2.5">{m.f1}%</td>
                    <td className="text-right px-4 py-2.5">{m.auc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-3">
            <p className="text-purple-300 text-xs leading-relaxed">
              <span className="font-semibold">Feature Importance:</span> Radar-derived features (reflectivity, echo tops)
              are the most impactful predictors — removing them degrades macro-F1 by 2.36 percentage points,
              confirming that real-time atmospheric sensing data is critical for accurate hazard classification.
            </p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            Section D — 4-Tier Alert Classification
        ═══════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeading title="4-Tier Alert Classification" subtitle="Risk-calibrated response levels" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <AlertTierCard tier="CLEAR" range="0.00–0.25" color="green" action="Proceed normally — no weather hazards detected along corridor." />
            <AlertTierCard tier="WATCH" range="0.25–0.50" color="yellow" action="Monitor conditions — weather system approaching corridor within 60 minutes." />
            <AlertTierCard tier="WARNING" range="0.50–0.75" color="orange" action="Consider alternate route — active hazard within corridor proximity zone." />
            <AlertTierCard tier="CRITICAL" range="0.75–1.00" color="red" action="Immediate action required — seek shelter or exit corridor at nearest safe point." />
          </div>

          {/* Risk Scoring Formula */}
          <div className="bg-ww-surface border border-ww-border rounded-xl p-5">
            <h4 className="text-white font-semibold text-sm mb-3">5-Component Risk Scoring</h4>
            <p className="text-gray-400 text-xs mb-4 leading-relaxed">
              The composite risk score is a weighted sum of five independent assessment components,
              each normalized to [0, 1]:
            </p>
            <div className="flex flex-wrap gap-3">
              <WeightBadge name="Proximity" weight="0.25" />
              <WeightBadge name="Intersection" weight="0.30" />
              <WeightBadge name="Severity" weight="0.20" />
              <WeightBadge name="Exposure" weight="0.15" />
              <WeightBadge name="Escape" weight="0.10" />
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            Section E — Performance Evaluation
        ═══════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeading title="Performance Evaluation" subtitle="Benchmarked against historical events" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-5 text-center">
              <div className="text-3xl font-extrabold text-green-400 mb-1">1.97ms</div>
              <div className="text-gray-400 text-xs">Mean Alert Latency</div>
              <div className="text-green-500/70 text-xs mt-1">72.9% reduction vs. baseline</div>
            </div>
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-5 text-center">
              <div className="text-3xl font-extrabold text-blue-400 mb-1">24.8 min</div>
              <div className="text-gray-400 text-xs">Mean Lead Time Advantage</div>
              <div className="text-blue-500/70 text-xs mt-1">vs. NWS public alert timing</div>
            </div>
          </div>

          {/* Historical events table */}
          <div className="overflow-x-auto rounded-xl border border-ww-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ww-surface text-gray-400 text-xs">
                  <th className="text-left px-4 py-3 font-medium">Event</th>
                  <th className="text-right px-4 py-3 font-medium">WeatherWise</th>
                  <th className="text-right px-4 py-3 font-medium">NWS</th>
                  <th className="text-right px-4 py-3 font-medium">Advantage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ww-border">
                {HISTORICAL_EVENTS.map((e) => (
                  <tr key={e.event} className="text-gray-300 hover:bg-ww-surface/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-white text-xs">{e.event}</div>
                      <div className="text-gray-500 text-xs">{e.date}</div>
                    </td>
                    <td className="text-right px-4 py-2.5">{e.ww} min</td>
                    <td className="text-right px-4 py-2.5">{e.nws} min</td>
                    <td className="text-right px-4 py-2.5 text-green-400 font-medium">+{e.adv} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-gray-500 text-xs mt-3">
            Methodology: Monte Carlo simulation (n=1,000 per event) with historical weather radar
            and NWS alert archive data.
          </p>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            Section F — Publication
        ═══════════════════════════════════════════════════════════════ */}
        <section className="text-center pb-8">
          <SectionHeading title="Publication" subtitle="Peer-reviewed research" />
          <div className="bg-ww-surface border border-ww-border rounded-xl p-6 max-w-2xl mx-auto">
            <p className="text-gray-300 text-sm leading-relaxed mb-4">
              P. Gundeti, &ldquo;WeatherWise: AI-Enhanced Framework for Real-Time Multi-Hazard
              Severe Weather Alerting and Dynamic Rerouting for Highway Travelers,&rdquo;
              <span className="italic text-gray-400"> the journal</span>, 2025.
            </p>
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-blue-500/20 border border-blue-500/30 text-blue-300">
              Published in the journal — Open Access
            </span>
          </div>
        </section>

      </div>
    </div>
  );
}

/* ── Data Constants ── */

const ML_METRICS = [
  { type: 'Tornado',              precision: '98.5', recall: '99.5', f1: '99.0', auc: '0.9998' },
  { type: 'Severe Thunderstorm',  precision: '94.8', recall: '95.1', f1: '95.0', auc: '0.9998' },
  { type: 'Flash Flood',          precision: '99.9', recall: '99.7', f1: '99.8', auc: '0.9999' },
  { type: 'Winter Storm',         precision: '98.0', recall: '98.8', f1: '98.4', auc: '0.9997' },
  { type: 'Hurricane',            precision: '94.4', recall: '95.4', f1: '94.9', auc: '0.9998' },
  { type: 'Wildfire',             precision: '99.8', recall: '99.8', f1: '99.8', auc: '1.0000' },
];

const HISTORICAL_EVENTS = [
  { event: 'London KY EF-4 Tornado',          date: 'May 2025',  ww: '36.9', nws: '12.0', adv: '24.9' },
  { event: 'Hurricane Helene, NC',             date: 'Sept 2024', ww: '44.3', nws: '30.0', adv: '14.3' },
  { event: 'TX Flash Flood',                   date: 'May 2024',  ww: '35.2', nws: '15.0', adv: '20.2' },
  { event: 'Winter Storm Elliott, Buffalo',    date: 'Dec 2022',  ww: '60.0', nws: '30.0', adv: '30.0' },
  { event: 'OR Wildfire Smoke',                date: 'Sept 2020', ww: '39.8', nws: '5.0',  adv: '34.8' },
];

/* ── Sub-components ── */

function SectionHeading({ title, subtitle }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl sm:text-2xl font-bold text-white">{title}</h2>
      <p className="text-gray-500 text-sm">{subtitle}</p>
    </div>
  );
}

function ImpactCard({ value, label, color }) {
  const colors = {
    red:    'from-red-500/15 to-red-600/10 border-red-500/25',
    orange: 'from-orange-500/15 to-orange-600/10 border-orange-500/25',
    yellow: 'from-yellow-500/15 to-yellow-600/10 border-yellow-500/25',
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-5 text-center`}>
      <div className="text-2xl font-extrabold text-white mb-1">{value}</div>
      <div className="text-gray-400 text-xs font-medium">{label}</div>
    </div>
  );
}

function PipelineCard({ step, title, description, color }) {
  const colors = {
    blue:   'border-blue-500/30 bg-blue-500/5',
    purple: 'border-purple-500/30 bg-purple-500/5',
    orange: 'border-orange-500/30 bg-orange-500/5',
    cyan:   'border-cyan-500/30 bg-cyan-500/5',
  };
  const numColors = {
    blue:   'bg-blue-500/20 text-blue-400',
    purple: 'bg-purple-500/20 text-purple-400',
    orange: 'bg-orange-500/20 text-orange-400',
    cyan:   'bg-cyan-500/20 text-cyan-400',
  };
  return (
    <div className={`border rounded-xl p-4 flex items-start gap-4 ${colors[color]}`}>
      <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center font-bold text-sm ${numColors[color]}`}>
        {step}
      </div>
      <div>
        <h4 className="text-white font-semibold text-sm">{title}</h4>
        <p className="text-gray-400 text-xs leading-relaxed mt-1">{description}</p>
      </div>
    </div>
  );
}

function PipelineArrow() {
  return (
    <div className="flex justify-center">
      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    </div>
  );
}

function AlertTierCard({ tier, range, color, action }) {
  const colors = {
    green:  'border-green-500/30 bg-green-500/10',
    yellow: 'border-yellow-500/30 bg-yellow-500/10',
    orange: 'border-orange-500/30 bg-orange-500/10',
    red:    'border-red-500/30 bg-red-500/10',
  };
  const headerColors = {
    green:  'text-green-400',
    yellow: 'text-yellow-400',
    orange: 'text-orange-400',
    red:    'text-red-400',
  };
  return (
    <div className={`border rounded-xl p-4 ${colors[color]}`}>
      <div className={`font-bold text-sm mb-1 ${headerColors[color]}`}>{tier}</div>
      <div className="text-gray-500 text-xs mb-2">{range}</div>
      <p className="text-gray-400 text-xs leading-relaxed">{action}</p>
    </div>
  );
}

function WeightBadge({ name, weight }) {
  return (
    <div className="flex items-center gap-2 bg-ww-dark border border-ww-border rounded-lg px-3 py-2">
      <span className="text-gray-300 text-xs font-medium">{name}</span>
      <span className="text-blue-400 text-xs font-bold">{weight}</span>
    </div>
  );
}

function DataRow({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300 font-medium">{value}</span>
    </div>
  );
}
