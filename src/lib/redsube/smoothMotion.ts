import { projectPointOnPath, geoDistance, type LatLng } from './matchingEngine';

export interface SmoothVehicleState {
    id: string;
    currentProgressMeters: number;
    targetProgressMeters: number;
    currentPos: [number, number];
    targetPos: [number, number];
    speedMetersPerSec: number;
    bearing: number;
    lastUpdateMs: number;
}

const vehicleTrackerMap = new Map<string, SmoothVehicleState>();

/**
 * Obtiene o calcula la posición suavizada de un colectivo sin saltos bruscos
 */
export function getInterpolatedVehiclePosition(
    vehicleId: string,
    rawPos: [number, number],
    path: LatLng[],
    rawSpeedKmH: number = 25,
    rawBearing: number = 0,
    deltaTimeSec: number = 0.05
): { pos: [number, number]; progressMeters: number; bearing: number } {
    if (!path || path.length < 2) {
        return { pos: rawPos, progressMeters: 0, bearing: rawBearing };
    }

    const now = Date.now();
    let state = vehicleTrackerMap.get(vehicleId);

    // Si es la primera vez que vemos este colectivo, proyectarlo e inicializar estado
    if (!state) {
        const proj = projectPointOnPath({ lat: rawPos[0], lng: rawPos[1] }, path);
        const initProgress = proj ? proj.distFromStartMeters : 0;

        state = {
            id: vehicleId,
            currentProgressMeters: initProgress,
            targetProgressMeters: initProgress,
            currentPos: rawPos,
            targetPos: rawPos,
            speedMetersPerSec: Math.max(3, (rawSpeedKmH || 25) / 3.6),
            bearing: rawBearing,
            lastUpdateMs: now
        };
        vehicleTrackerMap.set(vehicleId, state);
        return { pos: rawPos, progressMeters: initProgress, bearing: rawBearing };
    }

    // Al recibir una nueva coordenada GPS, proyectarla como la meta (target)
    const proj = projectPointOnPath({ lat: rawPos[0], lng: rawPos[1] }, path);
    if (proj) {
        state.targetProgressMeters = proj.distFromStartMeters;
        state.targetPos = [proj.closestPoint.lat, proj.closestPoint.lng];
    }
    state.speedMetersPerSec = Math.max(3, (rawSpeedKmH || 25) / 3.6);

    // Calcular avance continuo sobre la ruta + convergencia suave (LERP Alpha Filter)
    const progressError = state.targetProgressMeters - state.currentProgressMeters;
    
    // Si la diferencia es muy grande (ej: > 5 km), sincronización directa
    if (Math.abs(progressError) > 5000) {
        state.currentProgressMeters = state.targetProgressMeters;
    } else {
        // Avance continuo a velocidad de ruta + corrección progresiva hacia adelante
        // Regla estricta: NUNCA retroceder el colectivo hacia atrás si ya avanzó sobre la traza
        const baseStep = state.speedMetersPerSec * deltaTimeSec;
        const correctionStep = progressError > 0 ? Math.min(progressError * 0.08, 15) : 0;
        state.currentProgressMeters += (baseStep + correctionStep);
    }

    state.lastUpdateMs = now;

    // Convertir el progreso en metros a una coordenada [lat, lng] sobre la traza
    const interpolatedCoord = getCoordAtPathProgress(path, state.currentProgressMeters);
    state.currentPos = interpolatedCoord.pos;
    state.bearing = interpolatedCoord.bearing || rawBearing;

    return {
        pos: state.currentPos,
        progressMeters: state.currentProgressMeters,
        bearing: state.bearing
    };
}

/**
 * Proyecta la posición de un colectivo basándose en el desfasaje del ping GPS (timestamp) y la velocidad
 */
export function getProjectedVehiclePosition(
    vehicleId: string,
    rawPos: [number, number],
    path: LatLng[],
    rawSpeedKmH: number = 25,
    rawBearing: number = 0,
    pingTimestampMs?: number
): { pos: [number, number]; progressMeters: number; bearing: number; delaySeconds: number; isProjected: boolean } {
    if (!path || path.length < 2) {
        return { pos: rawPos, progressMeters: 0, bearing: rawBearing, delaySeconds: 0, isProjected: false };
    }

    const now = Date.now();
    const timestamp = pingTimestampMs && pingTimestampMs > 0 ? pingTimestampMs : now;
    // Evitar desfasajes negativos o exagerados (máx 10 minutos = 600s)
    const delaySeconds = Math.min(600, Math.max(0, (now - timestamp) / 1000));

    // Proyectar el punto crudo del ping sobre la traza
    const proj = projectPointOnPath({ lat: rawPos[0], lng: rawPos[1] }, path);
    const baseProgress = proj ? proj.distFromStartMeters : 0;

    // Velocidad en m/s (si es menor a 15 km/h por semáforo/tráfico, asumir 22 km/h para avance constante)
    const speedKmH = (rawSpeedKmH && rawSpeedKmH > 15) ? rawSpeedKmH : 22;
    const speedMetersPerSec = speedKmH / 3.6;

    // Metros avanzados desde la emisión del ping hasta el segundo actual
    const advancedMeters = speedMetersPerSec * delaySeconds;
    const targetProgress = baseProgress + advancedMeters;

    // Obtener la posición proyectada a lo largo del path
    const projectedCoord = getCoordAtPathProgress(path, targetProgress);

    return {
        pos: projectedCoord.pos,
        progressMeters: targetProgress,
        bearing: projectedCoord.bearing || rawBearing,
        delaySeconds: Math.round(delaySeconds),
        isProjected: delaySeconds > 15
    };
}

/**
 * Convierte una distancia en metros acumulada desde el origen del path a la coordenada GPS [lat, lng] correspondiente
 */
export function getCoordAtPathProgress(path: LatLng[], progressMeters: number): { pos: [number, number]; bearing: number } {
    if (!path || path.length === 0) return { pos: [0, 0], bearing: 0 };
    if (path.length === 1 || progressMeters <= 0) return { pos: [path[0].lat, path[0].lng], bearing: 0 };

    let accum = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i + 1];
        const segDist = geoDistance([p1.lat, p1.lng], [p2.lat, p2.lng]);

        if (accum + segDist >= progressMeters) {
            const remain = progressMeters - accum;
            const fraction = segDist > 0 ? remain / segDist : 0;
            const interpLat = p1.lat + fraction * (p2.lat - p1.lat);
            const interpLng = p1.lng + fraction * (p2.lng - p1.lng);

            // Calcular rumbo en grados entre p1 y p2
            const dLng = (p2.lng - p1.lng) * Math.PI / 180;
            const y = Math.sin(dLng) * Math.cos(p2.lat * Math.PI / 180);
            const x = Math.cos(p1.lat * Math.PI / 180) * Math.sin(p2.lat * Math.PI / 180) -
                      Math.sin(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.cos(dLng);
            let bearing = Math.atan2(y, x) * 180 / Math.PI;
            bearing = (bearing + 360) % 360;

            return { pos: [interpLat, interpLng], bearing: Math.round(bearing) };
        }

        accum += segDist;
    }

    const last = path[path.length - 1];
    return { pos: [last.lat, last.lng], bearing: 0 };
}

