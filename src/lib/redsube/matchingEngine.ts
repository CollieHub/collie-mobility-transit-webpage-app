import { getProjectedVehiclePosition } from './smoothMotion';

export interface LatLng {
    lat: number;
    lng: number;
}

export interface PathProjectionResult {
    distFromStartMeters: number;
    perpendicularDistMeters: number;
    closestPoint: LatLng;
    segmentIndex: number;
}

export interface MatchingResult {
    matchedScheduledVehicles: any[];
    fallbackGpsVehicles: any[];
}

/**
 * Distancia Haversine en metros entre dos coordenadas GPS [lat, lng]
 */
export function geoDistance(p1: [number, number], p2: [number, number]): number {
    const R = 6371000;
    const dLat = (p2[0] - p1[0]) * Math.PI / 180;
    const dLng = (p2[1] - p1[1]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Rumbo inicial en grados entre dos puntos LatLng
 */
export function calculateSegmentBearing(p1: LatLng, p2: LatLng): number {
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(p2.lat * Math.PI / 180);
    const x = Math.cos(p1.lat * Math.PI / 180) * Math.sin(p2.lat * Math.PI / 180) -
              Math.sin(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.cos(dLng);
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
}

/**
 * Proyecta un punto GPS sobre una polilínea (path) y calcula el progreso acumulado desde la cabecera
 */
export function projectPointOnPath(point: LatLng, path: LatLng[]): PathProjectionResult | null {
    if (!path || path.length < 2) return null;

    let minPerpendicularDist = Infinity;
    let bestSegmentIndex = 0;
    let bestProjectionPt: LatLng = path[0];

    for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i + 1];

        const l2 = (p2.lat - p1.lat) ** 2 + (p2.lng - p1.lng) ** 2;
        let projection: LatLng;

        if (l2 === 0) {
            projection = p1;
        } else {
            let t = ((point.lat - p1.lat) * (p2.lat - p1.lat) + (point.lng - p1.lng) * (p2.lng - p1.lng)) / l2;
            t = Math.max(0, Math.min(1, t));
            projection = {
                lat: p1.lat + t * (p2.lat - p1.lat),
                lng: p1.lng + t * (p2.lng - p1.lng)
            };
        }

        const dist = geoDistance([point.lat, point.lng], [projection.lat, projection.lng]);
        if (dist < minPerpendicularDist) {
            minPerpendicularDist = dist;
            bestSegmentIndex = i;
            bestProjectionPt = projection;
        }
    }

    let accumulatedDist = 0;
    for (let i = 0; i < bestSegmentIndex; i++) {
        accumulatedDist += geoDistance([path[i].lat, path[i].lng], [path[i + 1].lat, path[i + 1].lng]);
    }
    accumulatedDist += geoDistance(
        [path[bestSegmentIndex].lat, path[bestSegmentIndex].lng],
        [bestProjectionPt.lat, bestProjectionPt.lng]
    );

    return {
        distFromStartMeters: accumulatedDist,
        perpendicularDistMeters: minPerpendicularDist,
        closestPoint: bestProjectionPt,
        segmentIndex: bestSegmentIndex
    };
}

/**
 * Algoritmo de Matching Automático Nivel 2 y Nivel 3 (Espacio-Tiempo & Salida de Cabecera)
 */
export function matchGpsToScheduledTrips(
    scheduledVehicles: any[],
    gpsVehicles: any[],
    ramalesMap: Record<string, { path?: LatLng[]; stops?: any[] }> = {}
): MatchingResult {
    if (!gpsVehicles || gpsVehicles.length === 0) {
        return {
            matchedScheduledVehicles: scheduledVehicles || [],
            fallbackGpsVehicles: []
        };
    }

    const availableGpsPool = [...gpsVehicles];
    const matchedGpsIds = new Set<string>();

    const matchedScheduled = (scheduledVehicles || []).map((schedVeh: any) => {
        const tripId = String(schedVeh.trip_id || schedVeh.routeId || '').toUpperCase().trim();
        const routeShortName = String(schedVeh.route_short_name || schedVeh.shortName || schedVeh.code || '').toUpperCase().trim();
        const ramalData = (tripId ? ramalesMap[tripId] : null) || (schedVeh.routeId ? ramalesMap[schedVeh.routeId] : null);
        const path = ramalData?.path || [];

        const candidateGpsList = availableGpsPool.filter(csVeh => {
            if (matchedGpsIds.has(csVeh.id)) return false;
            const csTripId = String(csVeh.trip_id || csVeh.routeId || '').toUpperCase().trim();
            const csShortName = String(csVeh.route_short_name || csVeh.shortName || csVeh.code || '').toUpperCase().trim();

            const isSameTrip = tripId && csTripId && (tripId === csTripId || tripId.includes(csTripId) || csTripId.includes(tripId));
            const isSameRoute = routeShortName && csShortName && (routeShortName === csShortName || routeShortName.includes(csShortName) || csShortName.includes(routeShortName));
            
            const isSitRoute = routeShortName.startsWith('RZ') || routeShortName.includes('SIT');
            const isSitGps = csShortName.startsWith('RZ') || csShortName === '500' || csShortName === 'SIT';
            const isSitMatch = isSitRoute && isSitGps;

            return isSameTrip || isSameRoute || isSitMatch;
        });

        if (candidateGpsList.length === 0) return schedVeh;

        // --- NIVEL 3: DETECCIÓN EN CABECERA / TERMINAL DE SALIDA ---
        if (path.length > 0) {
            const terminalPt = path[0];
            const schedTimeSec = schedVeh.timestamp || Math.floor(Date.now() / 1000);
            const nowSec = Math.floor(Date.now() / 1000);

            if (Math.abs(nowSec - schedTimeSec) <= 1200) {
                const terminalMatch = candidateGpsList.find(csVeh => {
                    const gpsLat = csVeh.latitude || csVeh.lat || (csVeh.pos ? csVeh.pos[0] : 0);
                    const gpsLng = csVeh.longitude || csVeh.lng || (csVeh.pos ? csVeh.pos[1] : 0);
                    const distToTerminal = geoDistance([gpsLat, gpsLng], [terminalPt.lat, terminalPt.lng]);
                    return distToTerminal <= 500;
                });

                if (terminalMatch) {
                    matchedGpsIds.add(terminalMatch.id);
                    return {
                        ...schedVeh,
                        lat: terminalMatch.latitude || terminalMatch.lat || (terminalMatch.pos ? terminalMatch.pos[0] : schedVeh.lat),
                        lng: terminalMatch.longitude || terminalMatch.lng || (terminalMatch.pos ? terminalMatch.pos[1] : schedVeh.lng),
                        latitude: terminalMatch.latitude || terminalMatch.lat || (terminalMatch.pos ? terminalMatch.pos[0] : schedVeh.lat),
                        longitude: terminalMatch.longitude || terminalMatch.lng || (terminalMatch.pos ? terminalMatch.pos[1] : schedVeh.lng),
                        pos: terminalMatch.pos || [terminalMatch.latitude || terminalMatch.lat, terminalMatch.longitude || terminalMatch.lng],
                        speed: terminalMatch.speed,
                        bearing: terminalMatch.bearing,
                        timestamp: terminalMatch.timestamp || Math.floor(Date.now() / 1000),
                        license_plate: terminalMatch.license_plate || schedVeh.license_plate,
                        interno: terminalMatch.interno || schedVeh.interno,
                        hasRealGpsMatch: true,
                        matched_gps_id: terminalMatch.id,
                        match_type: 'terminal_departure',
                        match_confidence: 'HIGH'
                    };
                }
            }
        }



        // --- NIVEL 2: MATCHING ESPACIO-TEMPORAL SOBRE LA TRAZA CON VALIDADOR DE RUMBO ---
        if (path.length > 1) {
            const schedLat = schedVeh.latitude || schedVeh.lat || (schedVeh.pos ? schedVeh.pos[0] : 0);
            const schedLng = schedVeh.longitude || schedVeh.lng || (schedVeh.pos ? schedVeh.pos[1] : 0);
            const schedProj = projectPointOnPath({ lat: schedLat, lng: schedLng }, path);

            let bestMatch: any = null;
            let minScore = Infinity;

            for (const csVeh of candidateGpsList) {
                const rawLat = csVeh.latitude || csVeh.lat || (csVeh.pos ? csVeh.pos[0] : 0);
                const rawLng = csVeh.longitude || csVeh.lng || (csVeh.pos ? csVeh.pos[1] : 0);
                if (Math.abs(rawLat) < 0.1 && Math.abs(rawLng) < 0.1) continue;

                const pingTs = csVeh.timestamp || csVeh.lastLocationUpdateTime || csVeh.lastUpdateMs;
                const projResult = getProjectedVehiclePosition(
                    csVeh.id || 'gps-veh',
                    [rawLat, rawLng],
                    path,
                    Number(csVeh.speed) || 25,
                    csVeh.bearing || 0,
                    pingTs
                );

                const projectedLat = projResult.pos[0];
                const projectedLng = projResult.pos[1];
                const gpsProj = projectPointOnPath({ lat: projectedLat, lng: projectedLng }, path);

                if (!gpsProj) continue;
                if (gpsProj.perpendicularDistMeters > 500) continue;

                // Validar alineación de rumbo/orientación si el GPS reporta bearing válido (>0)
                const gpsBearing = Number(projResult.bearing || csVeh.bearing || 0);
                if (gpsBearing > 0 && gpsProj.segmentIndex >= 0 && gpsProj.segmentIndex < path.length - 1) {
                    const p1 = path[gpsProj.segmentIndex];
                    const p2 = path[gpsProj.segmentIndex + 1];
                    const routeBearing = calculateSegmentBearing(p1, p2);
                    let headingDiff = Math.abs(gpsBearing - routeBearing);
                    if (headingDiff > 180) headingDiff = 360 - headingDiff;

                    // Si marcha a más de 80° en sentido contrario sobre la traza, descartar
                    if (headingDiff > 80) continue;
                }

                const schedProgress = schedProj ? schedProj.distFromStartMeters : 0;
                const deltaProgress = Math.abs(gpsProj.distFromStartMeters - schedProgress);

                // Función de costo ponderada: favorece coincidencia precisa sobre la calle
                const weightedScore = deltaProgress + (2.5 * gpsProj.perpendicularDistMeters);

                if (deltaProgress <= 5000 && weightedScore < minScore) {
                    minScore = weightedScore;
                    bestMatch = {
                        ...csVeh,
                        latitude: projectedLat,
                        longitude: projectedLng,
                        lat: projectedLat,
                        lng: projectedLng,
                        pos: [projectedLat, projectedLng],
                        bearing: projResult.bearing,
                        delaySeconds: projResult.delaySeconds,
                        isProjected: projResult.isProjected
                    };
                }
            }

            if (bestMatch) {
                matchedGpsIds.add(bestMatch.id);
                const bestLat = bestMatch.latitude || bestMatch.lat || (bestMatch.pos ? bestMatch.pos[0] : schedVeh.lat);
                const bestLng = bestMatch.longitude || bestMatch.lng || (bestMatch.pos ? bestMatch.pos[1] : schedVeh.lng);

                return {
                    ...schedVeh,
                    lat: bestLat,
                    lng: bestLng,
                    latitude: bestLat,
                    longitude: bestLng,
                    pos: [bestLat, bestLng],
                    speed: bestMatch.speed,
                    bearing: bestMatch.bearing,
                    timestamp: bestMatch.timestamp || Math.floor(Date.now() / 1000),
                    license_plate: bestMatch.license_plate || schedVeh.license_plate,
                    interno: bestMatch.interno || schedVeh.interno,
                    hasRealGpsMatch: true,
                    matched_gps_id: bestMatch.id,
                    match_type: 'space_time',
                    match_confidence: minScore <= 2000 ? 'HIGH' : 'MEDIUM',
                    match_delta_meters: Math.round(minScore)
                };
            }
        }

        return schedVeh;
    });

    const fallbackGps = availableGpsPool.filter(csVeh => !matchedGpsIds.has(csVeh.id));

    return {
        matchedScheduledVehicles: matchedScheduled,
        fallbackGpsVehicles: fallbackGps
    };
}
