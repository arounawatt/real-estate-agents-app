import Link from 'next/link'

/** `param` : nom du paramètre d'URL — deux listes paginées sur la même page
 *  (dossiers ouverts / résolus) ont chacune le leur. */
export function Pager({
  basePath, page, totalPages, query = {}, param = 'page',
}: { basePath: string; page: number; totalPages: number; query?: Record<string, string>; param?: string }) {
  if (totalPages <= 1) return null

  const hrefFor = (p: number) => {
    const params = new URLSearchParams({ ...query, [param]: String(p) })
    return `${basePath}?${params.toString()}`
  }

  return (
    <div className="pager">
      <span>Page {page} / {totalPages}</span>
      <div className="pager-links">
        {page > 1
          ? <Link href={hrefFor(page - 1)}>Précédent</Link>
          : <span className="disabled">Précédent</span>}
        {page < totalPages
          ? <Link href={hrefFor(page + 1)}>Suivant</Link>
          : <span className="disabled">Suivant</span>}
      </div>
    </div>
  )
}
