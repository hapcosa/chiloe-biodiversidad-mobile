// Convierte `atributos_especificos` —el JSONB que el backend valida contra el
// JSON Schema de cada reino— en secciones legibles para la pantalla de detalle.
//
// Los esquemas viven en services/especies-api/config/schemas/ y usan
// `additionalProperties: false`, así que el conjunto de claves posibles es
// cerrado y conocido. Aun así el renderizado degrada con gracia: una clave que
// no esté en el mapa de abajo cae en "Otros datos" en vez de desaparecer, para
// que un esquema nuevo no deje la ficha muda hasta que alguien actualice la app.
import type {JsonValue, Reino, Species} from '../types/domain';

export interface FichaItem {
  label: string;
  value: string;
}

export interface FichaSection {
  titulo: string;
  items: FichaItem[];
  /** La comestibilidad de un hongo se destaca: es riesgo sanitario real. */
  destacada?: boolean;
}

/** Ruta de la propiedad: 'comportamiento.actividad' para las anidadas. */
type Ruta = string;

interface Grupo {
  titulo: string;
  rutas: Ruta[];
  destacada?: boolean;
}

const GRUPOS: Record<Reino, Grupo[]> = {
  animalia: [
    {
      titulo: 'Alimentación',
      rutas: ['alimentacion', 'dieta_detalle'],
    },
    {
      titulo: 'Comportamiento',
      rutas: [
        'comportamiento.actividad',
        'comportamiento.social',
        'comportamiento.migratorio',
      ],
    },
    {
      titulo: 'Morfología',
      rutas: ['clase', 'tamano_promedio_cm', 'peso_promedio_g'],
    },
    {
      titulo: 'Reproducción',
      rutas: ['reproduccion', 'epoca_reproductiva'],
    },
  ],
  plantae: [
    {
      titulo: 'Morfología',
      rutas: [
        'tipo_planta',
        'altura_promedio_m',
        'tipo_hoja.ciclo',
        'tipo_hoja.morfologia',
        'tipo_raiz',
      ],
    },
    {
      titulo: 'Floración y fruto',
      rutas: [
        'floracion_meses',
        'polinizacion',
        'fruto.descripcion',
        'fruto.comestible',
      ],
    },
    {titulo: 'Usos tradicionales', rutas: ['usos_tradicionales']},
  ],
  fungi: [
    {
      titulo: 'Comestibilidad',
      rutas: ['comestibilidad', 'advertencia'],
      destacada: true,
    },
    {
      titulo: 'Biología',
      rutas: ['tipo', 'simbiosis', 'tipo_himenio'],
    },
    {titulo: 'Dónde y cuándo', rutas: ['sustrato', 'temporada']},
  ],
  protista: [
    {
      titulo: 'Biología',
      rutas: ['grupo', 'morfologia', 'tamano_promedio_mm'],
    },
    {titulo: 'Ambiente', rutas: ['ambiente']},
    {
      titulo: 'Importancia ecológica',
      rutas: ['importancia_ecologica'],
    },
  ],
  monera: [
    {titulo: 'Biología', rutas: ['dominio', 'forma', 'gram']},
    {
      titulo: 'Metabolismo',
      rutas: ['metabolismo.fuente_energia', 'metabolismo.oxigeno'],
    },
    {
      titulo: 'Relevancia en Chiloé',
      rutas: ['relevancia_chiloe'],
    },
  ],
};

const LABELS: Record<string, string> = {
  advertencia: 'Advertencia',
  alimentacion: 'Tipo de dieta',
  altura_promedio_m: 'Altura promedio',
  ambiente: 'Ambiente',
  clase: 'Clase',
  comestibilidad: 'Comestibilidad',
  'comportamiento.actividad': 'Actividad',
  'comportamiento.migratorio': 'Migratorio',
  'comportamiento.social': 'Vida social',
  dieta_detalle: 'Qué come',
  dominio: 'Dominio',
  epoca_reproductiva: 'Época reproductiva',
  floracion_meses: 'Meses de floración',
  forma: 'Forma',
  'fruto.comestible': 'Fruto comestible',
  'fruto.descripcion': 'Fruto',
  gram: 'Tinción de Gram',
  grupo: 'Grupo',
  importancia_ecologica: 'Importancia ecológica',
  'metabolismo.fuente_energia': 'Fuente de energía',
  'metabolismo.oxigeno': 'Relación con el oxígeno',
  morfologia: 'Morfología',
  peso_promedio_g: 'Peso promedio',
  polinizacion: 'Polinización',
  relevancia_chiloe: 'Relevancia en Chiloé',
  reproduccion: 'Reproducción',
  simbiosis: 'Modo de vida',
  sustrato: 'Sustrato',
  tamano_promedio_cm: 'Tamaño promedio',
  tamano_promedio_mm: 'Tamaño promedio',
  temporada: 'Temporada',
  tipo: 'Tipo',
  'tipo_hoja.ciclo': 'Follaje',
  'tipo_hoja.morfologia': 'Hoja',
  tipo_himenio: 'Himenio',
  tipo_planta: 'Tipo de planta',
  tipo_raiz: 'Raíz',
  usos_tradicionales: 'Usos',
};

// Los enums de los esquemas van sin tildes ni ñ para no depender de la
// codificación en la BD; acá se les devuelve la ortografía correcta.
const VALORES: Record<string, string> = {
  aerobio_estricto: 'Aerobio estricto',
  agaricomiceto: 'Agaricomiceto',
  algas_doradas: 'Algas doradas',
  algas_pardas: 'Algas pardas',
  algas_rojas: 'Algas rojas',
  algas_verdes: 'Algas verdes',
  ameboide: 'Ameboide',
  anaerobio_estricto: 'Anaerobio estricto',
  anaerobio_facultativo: 'Anaerobio facultativo',
  anemofila: 'Anemófila (viento)',
  archaea: 'Archaea',
  ascomiceto: 'Ascomiceto',
  autogama: 'Autógama',
  autotrofo: 'Autótrofo',
  adventicia: 'Adventicia',
  aerea: 'Aérea',
  arbol: 'Árbol',
  arbusto: 'Arbusto',
  axonomorfa: 'Axonomorfa (pivotante)',
  bacilo: 'Bacilo',
  bacteria: 'Bacteria',
  basidiomiceto: 'Basidiomiceto',
  cactacea: 'Cactácea',
  caduca: 'Caduco',
  carnivoro: 'Carnívoro',
  carronero: 'Carroñero',
  catemeral: 'Catemeral',
  ciliado: 'Ciliado',
  coco: 'Coco',
  colonial: 'Colonial',
  comestible: 'Comestible',
  compuesta: 'Compuesta',
  crepuscular: 'Crepuscular',
  desconocido: 'Desconocida',
  desconocida: 'Desconocida',
  detritivoro: 'Detritívoro',
  diatomeas: 'Diatomeas',
  dientes: 'Dientes',
  dinoflagelados: 'Dinoflagelados',
  diurno: 'Diurno',
  dulceacuicola: 'Dulceacuícola',
  en_pareja: 'En pareja',
  endofito: 'Endófito',
  entomofila: 'Entomófila (insectos)',
  espirilo: 'Espirilo',
  espiroqueta: 'Espiroqueta',
  estiercol: 'Estiércol',
  estuarino: 'Estuarino',
  euglenoideos: 'Euglenoideos',
  fibra: 'Fibra',
  fibrosa: 'Fibrosa',
  filamentoso: 'Filamentoso',
  filtrador: 'Filtrador',
  flagelado: 'Flagelado',
  forraje: 'Forraje',
  frugivoro: 'Frugívoro',
  gleba: 'Gleba',
  granivoro: 'Granívoro',
  gregario: 'Gregario',
  helecho: 'Helecho',
  herbivoro: 'Herbívoro',
  heterotrofo: 'Heterótrofo',
  hierba: 'Hierba',
  hojarasca: 'Hojarasca',
  insectivoro: 'Insectívoro',
  invierno: 'Invierno',
  laminas: 'Láminas',
  levadura: 'Levadura',
  liana: 'Liana',
  liquen: 'Liquen',
  liquenizado: 'Liquenizado',
  liso: 'Liso',
  madera_muerta: 'Madera muerta',
  madera_viva: 'Madera viva',
  maderable: 'Maderable',
  marino: 'Marino',
  medicinal: 'Medicinal',
  micorrizico: 'Micorrízico',
  microaerofilo: 'Microaerófilo',
  mixotrofo: 'Mixótrofo',
  moho: 'Moho',
  mohos_mucilaginosos: 'Mohos mucilaginosos',
  mortal: 'Mortal',
  musgo: 'Musgo',
  negativo: 'Gram negativo',
  no_aplica: 'No aplica',
  no_comestible: 'No comestible',
  nectarivoro: 'Nectarívoro',
  nocturno: 'Nocturno',
  omnivoro: 'Omnívoro',
  ornamental: 'Ornamental',
  ornitofila: 'Ornitófila (aves)',
  otono: 'Otoño',
  otro_hongo: 'Otro hongo',
  ovoviviparo: 'Ovovivíparo',
  oviparo: 'Ovíparo',
  palmera: 'Palmera',
  parasito: 'Parásito',
  perenne: 'Perenne',
  piscivoro: 'Piscívoro',
  pleomorfo: 'Pleomorfo',
  pliegues: 'Pliegues',
  poros: 'Poros',
  positivo: 'Gram positivo',
  primavera: 'Primavera',
  protozoos: 'Protozoos',
  psicoactivo: 'Psicoactivo',
  quiropterofila: 'Quiropterófila (murciélagos)',
  rizoma: 'Rizoma',
  saprofito: 'Saprófito',
  semicaduca: 'Semicaduco',
  simbionte: 'Simbionte',
  simple: 'Simple',
  solitario: 'Solitario',
  suelo: 'Suelo',
  talo: 'Talo',
  terrestre_humedo: 'Terrestre húmedo',
  tintoreo: 'Tintóreo',
  todo_el_ano: 'Todo el año',
  toxico: 'Tóxico',
  trepadora: 'Trepadora',
  tuberosa: 'Tuberosa',
  unicelular: 'Unicelular',
  verano: 'Verano',
  vibrio: 'Vibrio',
  viviparo: 'Vivíparo',
  alimentario: 'Alimentario',
  ceremonial: 'Ceremonial',
  epifita: 'Epífita',
};

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const UNIDADES: Record<string, string> = {
  altura_promedio_m: ' m',
  peso_promedio_g: ' g',
  tamano_promedio_cm: ' cm',
  tamano_promedio_mm: ' mm',
};

/** `sonido_key` es una key de object storage, no un dato para mostrar. */
const OCULTAS = new Set(['sonido_key']);

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function etiqueta(ruta: Ruta): string {
  const conocida = LABELS[ruta];
  if (conocida) {
    return conocida;
  }
  const hoja = ruta.split('.').pop() ?? ruta;
  return capitalizar(hoja.replace(/_/g, ' '));
}

function leer(attrs: {[key: string]: JsonValue}, ruta: Ruta): JsonValue {
  return ruta.split('.').reduce<JsonValue>((actual, tramo) => {
    if (actual !== null && typeof actual === 'object' && !Array.isArray(actual)) {
      return actual[tramo] ?? null;
    }
    return null;
  }, attrs);
}

function formatearValor(ruta: Ruta, valor: JsonValue): string {
  if (valor === null || valor === undefined || valor === '') {
    return '';
  }
  if (typeof valor === 'boolean') {
    return valor ? 'Sí' : 'No';
  }
  if (typeof valor === 'number') {
    return `${valor}${UNIDADES[ruta] ?? ''}`;
  }
  if (typeof valor === 'string') {
    return VALORES[valor] ?? capitalizar(valor);
  }
  if (Array.isArray(valor)) {
    if (ruta === 'floracion_meses') {
      return valor
        .filter((m): m is number => typeof m === 'number' && m >= 1 && m <= 12)
        .map(m => capitalizar(MESES[m - 1] ?? ''))
        .join(', ');
    }
    return valor
      .map(item => formatearValor(ruta, item))
      .filter(Boolean)
      .join(', ');
  }
  return '';
}

export function construirFicha(species: Species): FichaSection[] {
  const attrs = species.atributos_especificos ?? {};
  const grupos = GRUPOS[species.reino] ?? [];
  const usadas = new Set<string>();

  const secciones = grupos.map(grupo => {
    const items: FichaItem[] = [];
    for (const ruta of grupo.rutas) {
      usadas.add(ruta.split('.')[0] ?? ruta);
      const value = formatearValor(ruta, leer(attrs, ruta));
      if (value) {
        items.push({label: etiqueta(ruta), value});
      }
    }
    return {
      titulo: grupo.titulo,
      items,
      destacada: grupo.destacada,
    };
  });

  // Claves que el esquema del reino ganó después de esta versión de la app.
  const otros: FichaItem[] = [];
  for (const [clave, valor] of Object.entries(attrs)) {
    if (usadas.has(clave) || OCULTAS.has(clave)) {
      continue;
    }
    const value = formatearValor(clave, valor);
    if (value) {
      otros.push({label: etiqueta(clave), value});
    }
  }
  if (otros.length > 0) {
    secciones.push({
      titulo: 'Otros datos',
      items: otros,
      destacada: false,
    });
  }

  return secciones.filter(seccion => seccion.items.length > 0);
}
