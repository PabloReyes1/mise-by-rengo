/** Une clases ignorando las vacías: cx('a', cond && 'b') */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
