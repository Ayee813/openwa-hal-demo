/** GET form of select filters; submitting reloads the page with the query. */
export function Filters({
  action,
  fields,
}: {
  action: string;
  fields: { name: string; value: string; options: [string, string][]; label: string }[];
}) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      {fields.map((f) => (
        <label key={f.name} className="flex flex-col gap-1 text-xs text-zinc-500">
          {f.label}
          <select
            name={f.name}
            defaultValue={f.value}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {f.options.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      ))}
      <button className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700">
        ກັ່ນຕອງ
      </button>
    </form>
  );
}
