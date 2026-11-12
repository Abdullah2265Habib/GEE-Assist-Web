import type { RatingSummary } from "../../api/types";
import { StarsDisplay } from "./Stars";

/** Average as a headline number, then one thin bar per score with its count as a direct label. */
export default function RatingBreakdown({ summary }: { summary: RatingSummary }) {
  if (summary.count === 0) return <p className="empty">No ratings yet. Yours would be the first.</p>;
  const max = Math.max(...[1, 2, 3, 4, 5].map((s) => summary.distribution[String(s)] ?? 0), 1);
  return (
    <div className="breakdown">
      <div className="breakdown-head">
        <span className="breakdown-avg">{summary.average?.toFixed(1)}</span>
        <div>
          <StarsDisplay value={summary.average ?? 0} size={18} />
          <span className="muted-note">
            from {summary.count} rating{summary.count === 1 ? "" : "s"}
          </span>
        </div>
      </div>
      <table className="breakdown-table">
        <caption className="visually-hidden">Number of ratings for each score</caption>
        <tbody>
          {[5, 4, 3, 2, 1].map((s) => {
            const n = summary.distribution[String(s)] ?? 0;
            return (
              <tr key={s} title={`${n} rating${n === 1 ? "" : "s"} of ${s} star${s === 1 ? "" : "s"}`}>
                <th scope="row">{s} ★</th>
                <td className="breakdown-bar-cell">
                  <span className="breakdown-bar" style={{ width: `${(n / max) * 100}%` }} />
                </td>
                <td className="num">{n}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
