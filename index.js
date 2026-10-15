const galleryPanels = document.querySelectorAll('.ag-panel');

function activatePanel(panel) {
	galleryPanels.forEach((galleryPanel) => {
		galleryPanel.classList.remove('ag-panel--active');
		galleryPanel.removeAttribute('aria-current');
	});

	panel.classList.add('ag-panel--active');
	panel.setAttribute('aria-current', 'true');
}

galleryPanels.forEach((panel, index) => {
	panel.addEventListener('mouseenter', () => activatePanel(panel));
	panel.addEventListener('focus', () => activatePanel(panel));
	panel.addEventListener('click', (event) => {
		event.preventDefault();
		activatePanel(panel);
	});
	panel.addEventListener('keydown', (event) => {
		if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;

		event.preventDefault();
		const direction = event.key === 'ArrowRight' ? 1 : -1;
		const nextIndex = (index + direction + galleryPanels.length) % galleryPanels.length;
		galleryPanels[nextIndex].focus();
	});
});
