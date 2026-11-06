export async function withTimeout(work,milliseconds,message) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(work),
      new Promise((_,reject) => { timer = setTimeout(() => reject(new Error(message)),milliseconds); }),
    ]);
  } finally { clearTimeout(timer); }
}
