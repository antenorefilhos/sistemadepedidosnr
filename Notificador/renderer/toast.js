const el = {
  toast: document.getElementById('toast'),
  level: document.getElementById('level'),
  age: document.getElementById('age'),
  title: document.getElementById('title'),
  body: document.getElementById('body'),
}

window.notificador.onToast(({ levelKey, levelLabel, title, body, age }) => {
  el.toast.className = `toast ${levelKey}`
  el.level.textContent = levelLabel
  el.age.textContent = age || ''
  el.title.textContent = title
  el.body.textContent = body

  // Reinicia a animacao de entrada mesmo se a janela ja estava visivel.
  void el.toast.offsetWidth
  el.toast.classList.add('show')
})

window.notificador.onToastHide(() => {
  el.toast.classList.remove('show')
  el.toast.classList.add('hide')
})

document.body.addEventListener('click', () => window.notificador.toastClicked())
