export function CoachingSection() {
  const tags = ["Opening Analysis", "Blunder Prevention", "Tactics Trainer"];

  return (
    <section className="mx-5 mb-6 rounded-2xl bg-navy p-5 text-white lg:mx-8 lg:mb-8 lg:p-8">
      <h2 className="text-lg font-bold">Grootmeester Coaching</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">
        Onze AI analyseert miljoenen partijen om je niet alleen de beste zet te
        leren, maar vooral het &ldquo;waarom&rdquo; erachter.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200"
          >
            {tag}
          </span>
        ))}
      </div>
    </section>
  );
}
