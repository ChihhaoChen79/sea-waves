// Bright stars of the best-known constellations (J2000).
// [ right ascension (hours), declination (degrees), magnitude, colour ]

const W = 0xffffff, B = 0xcad8ff, Y = 0xfff1d8, O = 0xffd2a1, R = 0xffb27a;

export const STARS = {
	// Orion
	betelgeuse: [ 5.919, 7.41, 0.5, R ], rigel: [ 5.242, - 8.20, 0.13, B ], bellatrix: [ 5.419, 6.35, 1.64, B ],
	saiph: [ 5.796, - 9.67, 2.06, B ], alnitak: [ 5.679, - 1.94, 1.77, B ], alnilam: [ 5.604, - 1.20, 1.69, B ],
	mintaka: [ 5.533, - 0.30, 2.23, B ], meissa: [ 5.586, 9.93, 3.4, B ],
	// Ursa Major (Big Dipper)
	dubhe: [ 11.062, 61.75, 1.79, O ], merak: [ 11.031, 56.38, 2.37, W ], phecda: [ 11.897, 53.69, 2.44, W ],
	megrez: [ 12.257, 57.03, 3.31, W ], alioth: [ 12.900, 55.96, 1.77, W ], mizar: [ 13.399, 54.93, 2.27, W ],
	alkaid: [ 13.792, 49.31, 1.86, B ],
	// Ursa Minor (Little Dipper)
	polaris: [ 2.530, 89.26, 1.98, Y ], yildun: [ 17.537, 86.59, 4.35, W ], epsUMi: [ 16.766, 82.04, 4.2, Y ],
	zetUMi: [ 15.734, 77.79, 4.3, W ], kochab: [ 14.845, 74.16, 2.08, O ], pherkad: [ 15.346, 71.83, 3.05, W ],
	etaUMi: [ 16.292, 75.76, 4.95, W ],
	// Cassiopeia
	caph: [ 0.153, 59.15, 2.27, Y ], schedar: [ 0.675, 56.54, 2.24, O ], gamCas: [ 0.945, 60.72, 2.15, B ],
	ruchbah: [ 1.430, 60.24, 2.68, W ], segin: [ 1.907, 63.67, 3.37, B ],
	// Cygnus, Lyra, Aquila (Summer Triangle)
	deneb: [ 20.691, 45.28, 1.25, W ], sadr: [ 20.370, 40.26, 2.23, Y ], albireo: [ 19.512, 27.96, 3.1, O ],
	gienah: [ 20.770, 33.97, 2.48, O ], delCyg: [ 19.750, 45.13, 2.87, W ],
	vega: [ 18.616, 38.78, 0.03, B ], zetLyr: [ 18.746, 37.61, 4.3, W ], delLyr: [ 18.908, 36.90, 4.3, O ],
	sulafat: [ 18.982, 32.69, 3.25, B ], sheliak: [ 18.835, 33.36, 3.5, B ],
	altair: [ 19.846, 8.87, 0.77, W ], tarazed: [ 19.771, 10.61, 2.7, O ], alshain: [ 19.922, 6.41, 3.7, Y ],
	// Scorpius
	antares: [ 16.490, - 26.43, 1.06, R ], graffias: [ 16.091, - 19.81, 2.6, B ], dschubba: [ 16.006, - 22.62, 2.3, B ],
	piSco: [ 15.981, - 26.11, 2.9, B ], sigSco: [ 16.353, - 25.59, 2.9, B ], tauSco: [ 16.598, - 28.22, 2.8, B ],
	epsSco: [ 16.836, - 34.29, 2.3, O ], muSco: [ 16.864, - 38.05, 3.0, B ], zetSco: [ 16.910, - 42.36, 3.6, O ],
	etaSco: [ 17.203, - 43.24, 3.3, W ], sargas: [ 17.622, - 43.00, 1.9, Y ], iotSco: [ 17.793, - 40.13, 3.0, Y ],
	kapSco: [ 17.708, - 39.03, 2.4, B ], shaula: [ 17.560, - 37.10, 1.6, B ], lesath: [ 17.513, - 37.30, 2.7, B ],
	// Leo
	regulus: [ 10.140, 11.97, 1.35, B ], etaLeo: [ 10.122, 16.76, 3.5, W ], algieba: [ 10.333, 19.84, 2.0, O ],
	adhafera: [ 10.278, 23.42, 3.4, W ], muLeo: [ 9.879, 26.01, 3.9, O ], epsLeo: [ 9.764, 23.77, 3.0, Y ],
	denebola: [ 11.818, 14.57, 2.1, W ], zosma: [ 11.235, 20.52, 2.6, W ], chertan: [ 11.237, 15.43, 3.3, W ],
	// Taurus and the Pleiades
	aldebaran: [ 4.599, 16.51, 0.85, R ], elnath: [ 5.438, 28.61, 1.65, B ], zetTau: [ 5.628, 21.14, 3.0, B ],
	gamTau: [ 4.330, 15.63, 3.6, O ], delTau: [ 4.382, 17.54, 3.8, O ], epsTau: [ 4.477, 19.18, 3.5, O ],
	theTau: [ 4.478, 15.87, 3.4, W ],
	alcyone: [ 3.791, 24.11, 2.87, B ], atlas: [ 3.819, 24.05, 3.6, B ], electra: [ 3.747, 24.11, 3.7, B ],
	maia: [ 3.763, 24.37, 3.9, B ], merope: [ 3.772, 23.95, 4.1, B ], taygeta: [ 3.754, 24.47, 4.3, B ],
	// Gemini
	castor: [ 7.577, 31.89, 1.58, W ], pollux: [ 7.755, 28.03, 1.14, O ], alhena: [ 6.629, 16.40, 1.9, W ],
	mebsuta: [ 6.732, 25.13, 3.0, Y ], tejat: [ 6.383, 22.51, 2.9, R ], wasat: [ 7.335, 21.98, 3.5, W ],
	// Canis Major, Canis Minor
	sirius: [ 6.752, - 16.72, - 1.46, W ], mirzam: [ 6.378, - 17.96, 1.98, B ], adhara: [ 6.977, - 28.97, 1.5, B ],
	wezen: [ 7.140, - 26.39, 1.84, Y ], aludra: [ 7.402, - 29.30, 2.45, B ], procyon: [ 7.655, 5.22, 0.34, Y ],
	// Southern Cross and the Pointers
	acrux: [ 12.443, - 63.10, 0.77, B ], mimosa: [ 12.795, - 59.69, 1.25, B ], gacrux: [ 12.519, - 57.11, 1.6, R ],
	delCru: [ 12.252, - 58.75, 2.8, B ], rigilKent: [ 14.660, - 60.83, - 0.27, Y ], hadar: [ 14.064, - 60.37, 0.6, B ],
	// Pegasus and Andromeda
	markab: [ 23.079, 15.21, 2.5, W ], scheat: [ 23.063, 28.08, 2.4, R ], algenib: [ 0.221, 15.18, 2.8, B ],
	alpheratz: [ 0.140, 29.09, 2.06, B ], delAnd: [ 0.655, 30.86, 3.3, O ], mirach: [ 1.162, 35.62, 2.05, R ],
	almach: [ 2.065, 42.33, 2.1, O ], enif: [ 21.737, 9.88, 2.4, O ],
	// Sagittarius (the Teapot)
	kausAus: [ 18.403, - 34.38, 1.85, B ], nunki: [ 18.921, - 26.30, 2.05, B ], ascella: [ 19.044, - 29.88, 2.6, W ],
	kausMed: [ 18.350, - 29.83, 2.7, O ], kausBor: [ 18.466, - 25.42, 2.8, O ], alnasl: [ 18.097, - 30.42, 3.0, O ],
	phiSgr: [ 18.761, - 26.99, 3.2, B ], tauSgr: [ 19.116, - 27.67, 3.3, O ],
	// Boötes, Virgo
	arcturus: [ 14.261, 19.18, - 0.05, O ], izar: [ 14.750, 27.07, 2.4, O ], seginus: [ 14.535, 38.31, 3.0, W ],
	nekkar: [ 15.032, 40.39, 3.5, Y ], delBoo: [ 15.258, 33.31, 3.5, Y ], muphrid: [ 13.911, 18.40, 2.7, Y ],
	rhoBoo: [ 14.531, 30.37, 3.6, O ], spica: [ 13.420, - 11.16, 0.97, B ],
	// Auriga
	capella: [ 5.278, 46.00, 0.08, Y ], menkalinan: [ 5.992, 44.95, 1.9, W ], theAur: [ 5.995, 37.21, 2.6, W ],
	iotAur: [ 4.950, 33.17, 2.7, O ], epsAur: [ 5.033, 43.82, 3.0, Y ],
	// Perseus
	mirfak: [ 3.405, 49.86, 1.8, Y ], algol: [ 3.136, 40.96, 2.1, B ], delPer: [ 3.715, 47.79, 3.0, B ],
	gamPer: [ 3.080, 53.51, 2.9, Y ], epsPer: [ 3.964, 40.01, 2.9, B ], zetPer: [ 3.902, 31.88, 2.85, B ],
	// Other very bright stars
	canopus: [ 6.399, - 52.70, - 0.74, W ], achernar: [ 1.629, - 57.24, 0.46, B ], fomalhaut: [ 22.961, - 29.62, 1.16, W ]
};

// Approximate home of each common time zone, so the sky can be drawn for the
// viewer's region without asking for their location. [ latitude, longitude ]
export const ZONES = {
	'Asia/Taipei': [ 25.03, 121.56 ], 'Asia/Tokyo': [ 35.68, 139.69 ], 'Asia/Shanghai': [ 31.23, 121.47 ],
	'Asia/Hong_Kong': [ 22.32, 114.17 ], 'Asia/Macau': [ 22.2, 113.55 ], 'Asia/Singapore': [ 1.35, 103.82 ],
	'Asia/Seoul': [ 37.57, 126.98 ], 'Asia/Bangkok': [ 13.76, 100.5 ], 'Asia/Kolkata': [ 23.0, 79.0 ],
	'Asia/Calcutta': [ 23.0, 79.0 ], 'Asia/Dubai': [ 25.2, 55.27 ], 'Asia/Jakarta': [ - 6.2, 106.85 ],
	'Asia/Manila': [ 14.6, 120.98 ], 'Asia/Ho_Chi_Minh': [ 10.82, 106.63 ], 'Asia/Saigon': [ 10.82, 106.63 ],
	'Asia/Kuala_Lumpur': [ 3.14, 101.69 ], 'Asia/Jerusalem': [ 31.77, 35.21 ], 'Asia/Karachi': [ 24.86, 67.0 ],
	'Asia/Dhaka': [ 23.81, 90.41 ], 'Asia/Kathmandu': [ 27.72, 85.32 ], 'Asia/Riyadh': [ 24.71, 46.68 ],
	'Asia/Tehran': [ 35.69, 51.39 ], 'Asia/Yangon': [ 16.87, 96.2 ], 'Asia/Colombo': [ 6.93, 79.86 ],
	'Europe/London': [ 51.51, - 0.13 ], 'Europe/Paris': [ 48.86, 2.35 ], 'Europe/Berlin': [ 52.52, 13.4 ],
	'Europe/Madrid': [ 40.42, - 3.7 ], 'Europe/Rome': [ 41.9, 12.5 ], 'Europe/Amsterdam': [ 52.37, 4.9 ],
	'Europe/Stockholm': [ 59.33, 18.07 ], 'Europe/Moscow': [ 55.76, 37.62 ], 'Europe/Istanbul': [ 41.01, 28.98 ],
	'Europe/Athens': [ 37.98, 23.73 ], 'Europe/Lisbon': [ 38.72, - 9.14 ], 'Europe/Dublin': [ 53.35, - 6.26 ],
	'Europe/Zurich': [ 47.37, 8.54 ], 'Europe/Vienna': [ 48.21, 16.37 ], 'Europe/Warsaw': [ 52.23, 21.01 ],
	'Europe/Oslo': [ 59.91, 10.75 ], 'Europe/Helsinki': [ 60.17, 24.94 ], 'Europe/Copenhagen': [ 55.68, 12.57 ],
	'Europe/Brussels': [ 50.85, 4.35 ], 'Europe/Prague': [ 50.08, 14.44 ],
	'America/New_York': [ 40.71, - 74.01 ], 'America/Chicago': [ 41.88, - 87.63 ], 'America/Denver': [ 39.74, - 104.99 ],
	'America/Phoenix': [ 33.45, - 112.07 ], 'America/Los_Angeles': [ 34.05, - 118.24 ], 'America/Anchorage': [ 61.22, - 149.9 ],
	'Pacific/Honolulu': [ 21.31, - 157.86 ], 'America/Toronto': [ 43.65, - 79.38 ], 'America/Vancouver': [ 49.28, - 123.12 ],
	'America/Mexico_City': [ 19.43, - 99.13 ], 'America/Sao_Paulo': [ - 23.55, - 46.63 ],
	'America/Argentina/Buenos_Aires': [ - 34.6, - 58.38 ], 'America/Santiago': [ - 33.45, - 70.67 ],
	'America/Lima': [ - 12.05, - 77.04 ], 'America/Bogota': [ 4.71, - 74.07 ], 'America/Halifax': [ 44.65, - 63.57 ],
	'Australia/Sydney': [ - 33.87, 151.21 ], 'Australia/Melbourne': [ - 37.81, 144.96 ], 'Australia/Brisbane': [ - 27.47, 153.03 ],
	'Australia/Perth': [ - 31.95, 115.86 ], 'Australia/Adelaide': [ - 34.93, 138.6 ], 'Pacific/Auckland': [ - 36.85, 174.76 ],
	'Africa/Johannesburg': [ - 26.2, 28.05 ], 'Africa/Cairo': [ 30.04, 31.24 ], 'Africa/Lagos': [ 6.52, 3.38 ],
	'Africa/Nairobi': [ - 1.29, 36.82 ], 'Africa/Casablanca': [ 33.57, - 7.59 ]
};
