import { useState, useEffect } from 'react';
import { getApiBaseUrl } from '../lib/api/envConfig';

export interface AppConfig {
  banner_top_enabled: boolean;
  banner_menu_enabled: boolean;
  publicite_enabled: boolean;
  publicite_url?: string;
  banners_enabled: boolean;
  banners_mobile_enabled: boolean;
  banners_webpage_enabled: boolean;
  privacy_terms_enabled: boolean;
  privacy_terms_text: string;
  privacy_terms_version?: string;
  terms_content?: string;
  privacy_content?: string;
  realtime_transit_enabled: boolean;
  important_places_enabled: boolean;
  enabled_routes: string[];
  all_routes_state?: any[];
  live_polling_enabled?: boolean;
  live_polling_interval_sec?: number;
  google_ads_enabled?: boolean;
  google_ad_slot_header?: string;
  google_ad_slot_sidebar?: string;
  anonymous_selection_enabled?: boolean;
}

export const DEFAULT_TERMS_CONTENT = `<h3 style="font-size: 1.2rem; font-weight: 700; color: inherit; margin-top: 24px; margin-bottom: 12px;">1. ¿Quiénes somos?</h3>
<p style="margin-bottom: 16px;">Este servicio es desarrollado, mantenido y operado de forma exclusiva por <strong>CollieTech</strong> (en adelante, "la Empresa"). Nuestra meta es brindarte una herramienta tecnológica que te ayude a saber, de manera estimada y en tiempo real, por dónde vienen los colectivos y transportes públicos para que puedas planificar mejor tus viajes.</p>

<h3 style="font-size: 1.2rem; font-weight: 700; color: inherit; margin-top: 24px; margin-bottom: 12px;">2. Cómo funciona la información y cuáles son sus límites</h3>
<p style="margin-bottom: 16px;">La app procesa y muestra estimaciones de horarios, recorridos y la posición de los colectivos basándose en datos satelitales (GPS) y cálculos logísticos estimativos.</p>
<ul style="padding-left: 20px; margin-bottom: 16px;">
  <li style="margin-bottom: 8px;"><strong>Información orientativa:</strong> Toda la información que ves en la app es una referencia útil, pero no es una promesa matemática ni una garantía de puntualidad absoluta.</li>
  <li style="margin-bottom: 8px;"><strong>Tal como está disponible:</strong> Te ofrecemos el servicio según su disponibilidad técnica en cada momento.</li>
  <li style="margin-bottom: 8px;"><strong>Factores externos:</strong> Hay muchas cosas fuera de nuestro control que pueden alterar la información (como cortes de calle, desvíos de tránsito, manifestaciones, fallas de señal móvil de las empresas de transporte, problemas técnicos de los servidores o falta de señal de GPS). No nos hacemos responsables de las demoras, imprecisiones o cancelaciones de recorridos causadas por estas situaciones.</li>
</ul>

<h3 style="font-size: 1.2rem; font-weight: 700; color: inherit; margin-top: 24px; margin-bottom: 12px;">3. Lo que podés (y no podés) hacer en la app</h3>
<p style="margin-bottom: 16px;">Queremos que disfrutes de la aplicación de forma libre y segura. Para garantizar que funcione bien para todos, te comprometés a no realizar las siguientes acciones:</p>
<ul style="padding-left: 20px; margin-bottom: 16px;">
  <li style="margin-bottom: 8px;"><strong>Extracción automática de datos (Scraping):</strong> Queda prohibido usar robots, arañas web (spiders), scripts o cualquier sistema automatizado para copiar, recopilar o descargar los recorridos, horarios o datos de ubicación de la app.</li>
  <li style="margin-bottom: 8px;"><strong>Uso comercial no autorizado:</strong> No podés copiar, revender, alquilar ni integrar nuestros datos o partes de la app en otros sitios web o aplicaciones de terceros sin nuestro permiso explícito y por escrito.</li>
  <li style="margin-bottom: 8px;"><strong>Modificar la app (Ingeniería inversa):</strong> No está permitido intentar descifrar, descompilar o analizar el código fuente o los sistemas de seguridad de la aplicación.</li>
</ul>

<h3 style="font-size: 1.2rem; font-weight: 700; color: inherit; margin-top: 24px; margin-bottom: 12px;">4. Propiedad intelectual y marcas registradas</h3>
<p style="margin-bottom: 16px;"><strong>Lo que nos pertenece:</strong> El software, el diseño, los logos y las marcas de "¿Por dónde viene?" pertenecen a la Empresa y están protegidos por derechos de autor.</p>
<p style="margin-bottom: 16px;"><strong>Marcas de terceros:</strong> Los nombres de las líneas de colectivos, los números de ramales, sus logotipos y las tarifas que se muestran pertenecen a las respectivas empresas de transporte. Los mostramos en la app únicamente para ayudarte a identificarlos e informarte durante tus viajes. Su mención no implica que tengamos una sociedad, aval o relación comercial directa con esas empresas.</p>

<h3 style="font-size: 1.2rem; font-weight: 700; color: inherit; margin-top: 24px; margin-bottom: 12px;">5. Nuestra responsabilidad</h3>
<p style="margin-bottom: 16px;">Hacemos nuestro mejor esfuerzo para que la app funcione siempre y los datos sean lo más precisos posibles. Sin embargo, no nos responsabilizamos por inconvenientes personales, pasajes o conexiones de viaje perdidos, pérdida de tiempo, demoras o cualquier tipo de perjuicio derivado de las estimaciones horarias que muestra la aplicación.</p>

<h3 style="font-size: 1.2rem; font-weight: 700; color: inherit; margin-top: 24px; margin-bottom: 12px;">6. Cambios en estas condiciones</h3>
<p style="margin-bottom: 16px;">A veces podemos actualizar o modificar estos términos para adaptarnos a nuevas funciones de la app o cambios tecnológicos. Cuando lo hagamos, publicaremos la nueva versión aquí mismo. Al seguir usando la app, aceptas las nuevas condiciones.</p>

<h3 style="font-size: 1.2rem; font-weight: 700; color: inherit; margin-top: 24px; margin-bottom: 12px;">7. Dudas y cómo contactarnos</h3>
<p style="margin-bottom: 16px;">Si tenés alguna pregunta sobre estos términos, podés escribirnos directamente por correo electrónico a <a href="mailto:soporte@pordondeviene.com.ar" style="color: var(--accent, #3b82f6); text-decoration: none; font-weight: 600;">soporte@pordondeviene.com.ar</a>. Para cualquier desacuerdo que no podamos resolver de forma amistosa, nos someteremos a la resolución de los Tribunales de la Ciudad Autónoma de Buenos Aires, República Argentina.</p>`;

export const DEFAULT_PRIVACY_CONTENT = `<p style="margin-bottom: 24px; font-style: italic;">En "¿Por dónde viene?" nos tomamos muy en serio la privacidad y la seguridad de tu información. Queremos contarte de manera clara, simple y sin rodeos qué datos procesamos cuando usás nuestra aplicación y cómo los cuidamos.</p>

<h3 style="font-size: 1.2rem; font-weight: 700; color: inherit; margin-top: 24px; margin-bottom: 12px;">1. Nuestra filosofía de privacidad</h3>
<p style="margin-bottom: 16px;">Diseñamos la app para que recopile la menor cantidad de datos posible. Creemos que no necesitás compartir tu identidad personal (como tu nombre, documento o teléfono) para consultar el recorrido de un colectivo.</p>

<h3 style="font-size: 1.2rem; font-weight: 700; color: inherit; margin-top: 24px; margin-bottom: 12px;">2. La información que procesamos</h3>
<p style="margin-bottom: 16px;">Para que la aplicación funcione, interactuamos con tres tipos de datos:</p>
<ul style="padding-left: 20px; margin-bottom: 16px;">
  <li style="margin-bottom: 8px;"><strong>Ubicación de los colectivos:</strong> Mostramos la posición, recorrido y velocidad de las unidades en servicio. Esta información es puramente logística e informativa del transporte público y no contiene datos personales ni identifica a ningún pasajero.</li>
  <li style="margin-bottom: 8px;"><strong>Tu ubicación (GPS del dispositivo):</strong> Si elegís de forma voluntaria activar el GPS de tu celular o computadora para ver tu posición en el mapa, usaremos esa ubicación únicamente para situarte en el plano y mostrarte las paradas y colectivos más cercanos. Esta posición se procesa de forma temporal y anónima, sin vincularse jamás a tu nombre, DNI ni a ningún perfil personal.</li>
  <li style="margin-bottom: 8px;"><strong>Estadísticas de rendimiento:</strong> Recopilamos datos técnicos anónimos y generales (como qué líneas se consultan con más frecuencia, qué tipo de navegador usás o la resolución de tu pantalla) para mejorar la velocidad del mapa.</li>
</ul>

<h3 style="font-size: 1.2rem; font-weight: 700; color: inherit; margin-top: 24px; margin-bottom: 12px;">3. Datos que se guardan en tu dispositivo (Almacenamiento Local)</h3>
<p style="margin-bottom: 16px;">Para que tu experiencia sea más rápida y personalizada, guardamos algunas preferencias directamente en tu navegador o celular (usando Local Storage): tus líneas marcadas como favoritas, filtros del mapa y si preferís modo claro u oscuro, además de la aceptación de estos términos.</p>
<p style="margin-bottom: 16px;">Esta información reside de forma exclusiva en tu propio dispositivo. Nosotros no la subimos a la nube ni la guardamos en nuestros servidores externos. Podés borrarla en cualquier momento limpiando los datos de tu navegador.</p>

<h3 style="font-size: 1.2rem; font-weight: 700; color: inherit; margin-top: 24px; margin-bottom: 12px;">4. Mapas y proveedores tecnológicos</h3>
<p style="margin-bottom: 16px;">Para mostrarte los planos de las calles, utilizamos servicios de mapas provistos por terceros de confianza (como OpenStreetMap, CartoDB y Cloudflare). Al navegar por el mapa, tu dispositivo realiza solicitudes de red estándar a estos proveedores, las cuales se rigen por sus respectivas políticas de privacidad técnicas.</p>

<h3 style="font-size: 1.2rem; font-weight: 700; color: inherit; margin-top: 24px; margin-bottom: 12px;">5. Seguridad de los datos</h3>
<p style="margin-bottom: 16px;">Aunque no guardamos datos sobre tu identidad, implementamos medidas de seguridad y cifrado técnico en nuestros servidores y sistemas para proteger la integridad del servicio y evitar accesos no autorizados.</p>

<h3 style="font-size: 1.2rem; font-weight: 700; color: inherit; margin-top: 24px; margin-bottom: 12px;">6. Tu control y derechos</h3>
<p style="margin-bottom: 16px;">Dado que no te solicitamos nombres, correos electrónicos ni cuentas para navegar por el mapa habitual, no mantenemos un registro de tu identidad. Si tenés cualquier duda, podés escribirnos en cualquier momento por correo electrónico a: <a href="mailto:soporte@pordondeviene.com.ar" style="color: var(--accent, #3b82f6); text-decoration: none; font-weight: 600;">soporte@pordondeviene.com.ar</a>.</p>

<h3 style="font-size: 1.2rem; font-weight: 700; color: inherit; margin-top: 24px; margin-bottom: 12px;">7. Actualizaciones de esta política</h3>
<p style="margin-bottom: 16px;">De vez en cuando podemos realizar mejoras o ajustes a esta Política de Privacidad. Cuando ocurra una actualización, publicaremos el texto modificado en este espacio.</p>`;

const DEFAULT_CONFIG: AppConfig = {
  banner_top_enabled: false,
  banner_menu_enabled: false,
  publicite_enabled: false,
  publicite_url: '',
  banners_enabled: true,
  banners_mobile_enabled: true,
  banners_webpage_enabled: true,
  privacy_terms_enabled: true,
  privacy_terms_text: 'Bienvenido a ¿Por dónde viene? Tu app de transportes. Para poder utilizar la aplicación, por favor acepta nuestros términos y condiciones de uso y políticas de privacidad.',
  privacy_terms_version: 'v1',
  terms_content: DEFAULT_TERMS_CONTENT,
  privacy_content: DEFAULT_PRIVACY_CONTENT,
  realtime_transit_enabled: true,
  important_places_enabled: false,
  enabled_routes: [], // Si está vacío, asumimos que todas están habilitadas
  anonymous_selection_enabled: false,
  live_polling_enabled: false,
  live_polling_interval_sec: 60,
  google_ads_enabled: false, // Deshabilitado por completo por no estar aprobados aún (código preservado)
  google_ad_slot_header: '9343844412',
  google_ad_slot_sidebar: '9343844412'
};

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchConfig() {
      try {
        const baseUrl = getApiBaseUrl();
        const cleanUrl = baseUrl.replace(/\/$/, '');
        const configEndpoint = cleanUrl.endsWith('/v1') ? `${cleanUrl}/transit/config?t=${Date.now()}` : `${cleanUrl}/v1/transit/config?t=${Date.now()}`;
        const res = await fetch(configEndpoint, {
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            'X-Application-ID': 'COLLIE-TRANSIT-WEB'
          }
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch config: ${res.status}`);
        }

        const data = await res.json();
        if (data && (!data.enabled_routes || !Array.isArray(data.enabled_routes))) {
          data.enabled_routes = [];
        }
        
        if (isMounted) {
          setConfig(prev => ({
            ...prev,
            ...data,
            privacy_content: data?.privacy_content || prev.privacy_content || DEFAULT_PRIVACY_CONTENT,
            terms_content: data?.terms_content || prev.terms_content || DEFAULT_TERMS_CONTENT
          }));
          setIsLoading(false);
        }
      } catch (err: any) {
        console.warn('Config fetch failed, using defaults:', err.message);
        if (isMounted) {
          setError(err);
          setIsLoading(false);
        }
      }
    }

    fetchConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  return { config, isLoading, error };
}
