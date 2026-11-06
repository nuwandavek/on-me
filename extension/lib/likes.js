const heart = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/></svg>';

function update(button,liked) {
  button.classList.toggle('liked',Boolean(liked));
  button.setAttribute('aria-pressed',String(Boolean(liked)));
  button.setAttribute('aria-label',liked ? 'Unlike this try-on' : 'Like this try-on');
  button.title = liked ? 'Unlike' : 'Like';
}

export function syncLikeButtons(records) {
  for (const button of document.querySelectorAll('[data-like-id]')) {
    const record = records.find(item => item.id === button.dataset.likeId);
    if (record) update(button,record.liked);
  }
}

export function likeButton(record,{onChange,onError} = {}) {
  const button = document.createElement('button');
  button.type = 'button';button.className = 'like-button';button.dataset.likeId = record.id;
  button.innerHTML = heart;update(button,record.liked);
  button.addEventListener('click',async () => {
    button.disabled = true;
    try {
      const result = await chrome.runtime.sendMessage({type:'CBM_TOGGLE_LIKE',id:record.id});
      if (!result?.ok) throw new Error(result?.error || 'Could not save your like.');
      record.liked = result.liked;
      syncLikeButtons([record]);
      onChange?.();
    } catch (error) { onError?.(error.message); }
    finally { button.disabled = false; }
  });
  return button;
}
