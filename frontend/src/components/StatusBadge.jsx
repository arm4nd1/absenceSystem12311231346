const CLASSES = {
  present: "badge-present",
  late:    "badge-late",
  absent:  "badge-absent",
  excused: "badge-excused",
};

export default function StatusBadge({ status }) {
  const cls = CLASSES[status] ||
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700 text-slate-300";
  return <span className={cls}>{status}</span>;
}
