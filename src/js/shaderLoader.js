export async function loadShader(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load shader: ${path}`);
  }
  return response.text();
}

export async function loadShaders(paths) {
  const shaders = await Promise.all(paths.map(loadShader));
  return Object.fromEntries(paths.map((path, i) => [path, shaders[i]]));
}