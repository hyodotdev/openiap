import registry from '../../src/store-registry.json';

type StoreIdLanguage = 'typescript' | 'kotlin' | 'swift' | 'dart' | 'gdscript' | 'csharp';
const member = (id: string) => id.split(/[._-]/).map((part) => part[0].toUpperCase() + part.slice(1)).join('');

/** Registry ids are additive constants; they never extend IapStore. */
export function renderStoreIds(language: StoreIdLanguage): string {
  const rows = registry.stores.map(({id}) => {
    const name = member(id);
    switch (language) {
      case 'typescript': return `  ${name}: '${id}',`;
      case 'kotlin': return `    const val ${name} = "${id}"`;
      case 'swift': return `    public static let ${name} = "${id}"`;
      case 'dart': return `  static const String ${name[0].toLowerCase() + name.slice(1)} = '${id}';`;
      case 'gdscript': return `\tconst ${id.replace(/[._-]/g, '_').toUpperCase()} = "${id}"`;
      case 'csharp': return `    public const string ${name} = "${id}";`;
    }
  }).join('\n');
  switch (language) {
    case 'typescript': return `export const StoreIds = {\n${rows}\n} as const;\n`;
    case 'kotlin': return `public object StoreIds {\n${rows}\n}\n`;
    case 'swift': return `public enum StoreIds {\n${rows}\n}\n`;
    case 'dart': return `abstract final class StoreIds {\n${rows}\n}\n`;
    case 'gdscript': return `class StoreIds:\n${rows}\n`;
    case 'csharp': return `public static class StoreIds\n{\n${rows}\n}\n`;
  }
}
