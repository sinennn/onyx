module.exports = {
	content: [
		'./packages/renderer/index.html',
		'./packages/renderer/src/**/*.{js,ts,jsx,tsx}',
	],
	...(process.env.NODE_ENV === 'production' && {
		content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
	}),
	theme: {
		extend: {},
	},
	plugins: [],
};
