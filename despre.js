const revealElements = document.querySelectorAll('[data-reveal]');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (prefersReducedMotion || !('IntersectionObserver' in window)) {
	revealElements.forEach((element) => element.classList.add('is-visible'));
} else {
	document.documentElement.classList.add('js');

	const revealObserver = new IntersectionObserver((entries, observer) => {
		entries.forEach((entry) => {
			if (!entry.isIntersecting) return;

			entry.target.classList.add('is-visible');
			observer.unobserve(entry.target);
		});
	}, {
		threshold: 0.15,
		rootMargin: '0px 0px -32px 0px',
	});

	revealElements.forEach((element) => revealObserver.observe(element));
}
