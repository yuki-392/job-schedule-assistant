"use client";

type Props = {
  emailBody: string;
  canGenerateEmail: boolean;
  companyName: string;
  copyStatus: string;
  onCopy: () => void;
  ref?: React.Ref<HTMLElement>;
};

export function MailSection({
  emailBody,
  canGenerateEmail,
  companyName,
  copyStatus,
  onCopy,
  ref,
}: Props) {
  return (
    <section
      ref={ref}
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-lg font-semibold">3. メール文を生成してコピー</h2>
      {!emailBody ? (
        <p className="mt-2 text-sm text-slate-600">
          企業名と候補日（複数可）を選択すると、テンプレートメールを生成します。
        </p>
      ) : (
        <textarea
          readOnly
          value={emailBody}
          className="mt-3 h-52 w-full rounded-md border border-slate-300 p-3 text-sm"
        />
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onCopy}
          disabled={!canGenerateEmail}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          メール文をコピー
        </button>
        {canGenerateEmail && (
          <a
            href={`https://mail.google.com/mail/?view=cm&fs=1&to=&su=${encodeURIComponent(
              `${companyName} 面接日程のご返信`,
            )}&body=${encodeURIComponent(emailBody)}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            Gmail作成画面を開く
          </a>
        )}
      </div>
      {!canGenerateEmail && (
        <p className="mt-2 text-sm text-slate-500">
          企業名を入力し、空き候補を1件以上選択するとメール作成できます。
        </p>
      )}
      {copyStatus && <p className="mt-2 text-sm text-emerald-700">{copyStatus}</p>}
    </section>
  );
}
