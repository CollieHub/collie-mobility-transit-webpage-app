export interface ResolvedRedSubeAlias {
    route_id?: string;
    trip_id?: string;
    shape_id?: string;
    agency_id?: string;
    route_short_name: string;
    trip_headsign?: string;
    isFallback: boolean;
}

// Mapa canónico de referencia cruzada entre los códigos devueltos por la API de CuandoSUBO / SUBE
// y las entidades estándar cargadas en RedSube / Transit Core (GTFS)
export const CUANDOSUBO_ALIAS_MAP: Record<string, {
    route_id: string;
    trip_id?: string;
    shape_id?: string;
    agency_id?: string;
    route_short_name: string;
    trip_headsign?: string;
}> = {
    'RZ01': {
        route_id: 'route-5',
        trip_id: 'trip-rz01-ida',
        shape_id: 'shape-rz01',
        agency_id: 'agency-sit',
        route_short_name: 'RZ01',
        trip_headsign: 'B.Burgar - Terminal NK'
    },
    'RZ02': {
        route_id: 'route-6',
        trip_id: 'trip-rz02-ida',
        shape_id: 'shape-rz02',
        agency_id: 'agency-sit',
        route_short_name: 'RZ02',
        trip_headsign: 'Los Ceibos - Escalada'
    },
    'RZ03': {
        route_id: 'route-2',
        trip_id: 'trip-rz03-ida',
        shape_id: 'shape-rz03',
        agency_id: 'agency-sit',
        route_short_name: 'RZ03',
        trip_headsign: 'Cementerio - Terminal NK'
    },
    'RZ04': {
        route_id: 'route-7',
        trip_id: 'trip-rz04-ida',
        shape_id: 'shape-rz04',
        agency_id: 'agency-sit',
        route_short_name: 'RZ04',
        trip_headsign: 'Malvicino - Tala Y Felix Pagola'
    },
    'RZ07': {
        route_id: 'route-4',
        trip_id: 'trip-rz07-ida',
        shape_id: 'shape-rz07',
        agency_id: 'agency-sit',
        route_short_name: 'RZ07',
        trip_headsign: 'Lima - KM103'
    },
    'RZ10': {
        route_id: 'route-3',
        trip_id: 'trip-rz10-ida',
        shape_id: 'shape-rz10',
        agency_id: 'agency-sit',
        route_short_name: 'RZ10',
        trip_headsign: 'V.Negri-B.Meteor'
    },
    'RZ11': {
        route_id: 'route-1',
        trip_id: 'trip-rz11-ida',
        shape_id: 'shape-rz11',
        agency_id: 'agency-sit',
        route_short_name: 'RZ11',
        trip_headsign: 'LIMA - B.BOSCH'
    },
    '194A': {
        route_id: 'route-194',
        trip_id: 'trip-194a',
        shape_id: 'shape-194a',
        agency_id: 'agency-metropol',
        route_short_name: '194a',
        trip_headsign: 'a Pza. Miserere'
    },
    '194B': {
        route_id: 'route-194',
        trip_id: 'trip-194b',
        shape_id: 'shape-194b',
        agency_id: 'agency-metropol',
        route_short_name: '194b',
        trip_headsign: 'a Est. Escobar'
    },
    '194E': {
        route_id: 'route-194',
        trip_id: 'trip-194e',
        shape_id: 'shape-194e',
        agency_id: 'agency-metropol',
        route_short_name: '194e',
        trip_headsign: 'a Zarate'
    },
    '194F': {
        route_id: 'route-194',
        trip_id: 'trip-194f',
        shape_id: 'shape-194f',
        agency_id: 'agency-metropol',
        route_short_name: '194f',
        trip_headsign: 'a Est. Escobar'
    },
    '194I': {
        route_id: 'route-194',
        trip_id: 'trip-194i',
        shape_id: 'shape-194i',
        agency_id: 'agency-metropol',
        route_short_name: '194i',
        trip_headsign: 'a Retiro'
    },
    '228CB': {
        route_id: 'route-228',
        trip_id: 'trip-228cb',
        shape_id: 'shape-228cb',
        agency_id: 'agency-228',
        route_short_name: '228cb',
        trip_headsign: 'a A. del Plata'
    },
    '228CD': {
        route_id: 'route-228',
        trip_id: 'trip-228cd',
        shape_id: 'shape-228cd',
        agency_id: 'agency-228',
        route_short_name: '228cd',
        trip_headsign: 'a Luján'
    }
};

/**
 * Resuelve y enriquece la información de un ramal enviado por CuandoSUBO
 * mapeándolo contra el catálogo de entidades oficiales de RedSube / Transit Core.
 * Si el código no está cargado en RedSube, devuelve la entidad en Modo Fallback.
 */
export function resolveCuandoSuboAlias(
    routeShortName: string,
    tripHeadsign?: string
): ResolvedRedSubeAlias {
    if (!routeShortName) {
        return {
            route_short_name: 'Desconocido',
            isFallback: true
        };
    }

    const key = routeShortName.trim().toUpperCase();
    const headUpper = (tripHeadsign || '').toUpperCase();

    // Detección por palabras clave de destino para línea 500 / SIT Zárate
    if (key === '500' || key === 'SIT' || key.includes('500') || key.includes('SIT')) {
        if (headUpper.includes('CEIBO') || headUpper.includes('ESCALADA')) {
            return { ...CUANDOSUBO_ALIAS_MAP['RZ02'], trip_headsign: tripHeadsign ? tripHeadsign.trim() : CUANDOSUBO_ALIAS_MAP['RZ02'].trip_headsign, isFallback: false };
        }
        if (headUpper.includes('MALVICINO') || headUpper.includes('HOSPITAL') || headUpper.includes('PAGOLA')) {
            return { ...CUANDOSUBO_ALIAS_MAP['RZ04'], trip_headsign: tripHeadsign ? tripHeadsign.trim() : CUANDOSUBO_ALIAS_MAP['RZ04'].trip_headsign, isFallback: false };
        }
        if (headUpper.includes('CEMENTERIO') || headUpper.includes('FONAVI')) {
            return { ...CUANDOSUBO_ALIAS_MAP['RZ03'], trip_headsign: tripHeadsign ? tripHeadsign.trim() : CUANDOSUBO_ALIAS_MAP['RZ03'].trip_headsign, isFallback: false };
        }
        if (headUpper.includes('BURGAR')) {
            return { ...CUANDOSUBO_ALIAS_MAP['RZ01'], trip_headsign: tripHeadsign ? tripHeadsign.trim() : CUANDOSUBO_ALIAS_MAP['RZ01'].trip_headsign, isFallback: false };
        }
        if (headUpper.includes('METEOR') || headUpper.includes('NEGRI')) {
            return { ...CUANDOSUBO_ALIAS_MAP['RZ10'], trip_headsign: tripHeadsign ? tripHeadsign.trim() : CUANDOSUBO_ALIAS_MAP['RZ10'].trip_headsign, isFallback: false };
        }
        if (headUpper.includes('BOSCH')) {
            return { ...CUANDOSUBO_ALIAS_MAP['RZ11'], trip_headsign: tripHeadsign ? tripHeadsign.trim() : CUANDOSUBO_ALIAS_MAP['RZ11'].trip_headsign, isFallback: false };
        }
        if (headUpper.includes('LIMA') || headUpper.includes('103')) {
            return { ...CUANDOSUBO_ALIAS_MAP['RZ07'], trip_headsign: tripHeadsign ? tripHeadsign.trim() : CUANDOSUBO_ALIAS_MAP['RZ07'].trip_headsign, isFallback: false };
        }
    }

    const aliasMatch = CUANDOSUBO_ALIAS_MAP[key];

    if (aliasMatch) {
        return {
            ...aliasMatch,
            trip_headsign: tripHeadsign ? tripHeadsign.trim() : aliasMatch.trip_headsign,
            isFallback: false
        };
    }

    for (const [mapKey, aliasObj] of Object.entries(CUANDOSUBO_ALIAS_MAP)) {
        if (key.includes(mapKey)) {
            return {
                ...aliasObj,
                trip_headsign: tripHeadsign ? tripHeadsign.trim() : aliasObj.trip_headsign,
                isFallback: false
            };
        }
    }

    return {
        route_id: `cuandosubo-${key.toLowerCase()}`,
        route_short_name: routeShortName.trim(),
        trip_headsign: tripHeadsign ? tripHeadsign.trim() : '',
        isFallback: true
    };
}
