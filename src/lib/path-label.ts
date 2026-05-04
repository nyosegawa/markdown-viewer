export interface FilenameParts {
  basename: string;
  stem: string;
  extension: string;
}

export function basename(path: string): string {
  const clean = path.replace(/[/\\]+$/, "");
  const parts = clean.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export function dirname(path: string): string {
  const clean = path.replace(/[/\\]+$/, "");
  const parts = clean.split(/[\\/]/);
  parts.pop();
  return parts.join("/");
}

export function splitFilename(path: string): FilenameParts {
  const name = basename(path);
  const dot = name.lastIndexOf(".");
  if (dot <= 0) {
    return { basename: name, stem: name, extension: "" };
  }
  return {
    basename: name,
    stem: name.slice(0, dot),
    extension: name.slice(dot),
  };
}

export function normalizeRenameStem(input: string, extension: string): string {
  const trimmed = input.trim();
  if (extension && trimmed.toLowerCase().endsWith(extension.toLowerCase())) {
    return trimmed.slice(0, -extension.length).trim();
  }
  return trimmed;
}
