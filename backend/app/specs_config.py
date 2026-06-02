"""
Field templates per equipment type.
Each field: key, label, type (text|number|select|boolean|scale), options, min, max, placeholder.
"""

SPECS_BY_TIPO: dict[str, list[dict]] = {
    'Portátil': [
        {'key': 'pantalla_pulgadas', 'label': 'Pantalla (pulg.)', 'type': 'text', 'placeholder': 'Ej: 15.6'},
        {'key': 'cpu', 'label': 'Procesador', 'type': 'text', 'placeholder': 'Ej: Intel Core i7-1165G7'},
        {'key': 'ram_gb', 'label': 'RAM (GB)', 'type': 'number'},
        {'key': 'almacenamiento_gb', 'label': 'Almacenamiento (GB)', 'type': 'number'},
        {'key': 'tipo_almacenamiento', 'label': 'Tipo almacenamiento', 'type': 'select',
         'options': ['SSD', 'HDD', 'SSD + HDD', 'eMMC', 'NVMe']},
        {'key': 'sistema_operativo', 'label': 'Sistema operativo', 'type': 'text', 'placeholder': 'Ej: Windows 11 Pro'},
        {'key': 'bateria_estado', 'label': 'Estado batería', 'type': 'select',
         'options': ['Bueno', 'Regular', 'Malo', 'Por reemplazar', 'Sin batería']},
        {'key': 'estado_general', 'label': 'Estado general (1–5)', 'type': 'scale', 'min': 1, 'max': 5},
    ],
    'Celular': [
        {'key': 'imei1', 'label': 'IMEI 1', 'type': 'text'},
        {'key': 'imei2', 'label': 'IMEI 2', 'type': 'text'},
        {'key': 'tiene_esim', 'label': 'Tiene eSIM', 'type': 'boolean'},
        {'key': 'cpu', 'label': 'Procesador', 'type': 'text', 'placeholder': 'Ej: Snapdragon 888'},
        {'key': 'ram_gb', 'label': 'RAM (GB)', 'type': 'number'},
        {'key': 'almacenamiento_gb', 'label': 'Almacenamiento (GB)', 'type': 'number'},
        {'key': 'sistema_operativo', 'label': 'Sistema operativo', 'type': 'select',
         'options': ['Android', 'iOS', 'HarmonyOS', 'Otro']},
        {'key': 'estado_general', 'label': 'Estado general (1–5)', 'type': 'scale', 'min': 1, 'max': 5},
    ],
    'Tablet': [
        {'key': 'pantalla_pulgadas', 'label': 'Pantalla (pulg.)', 'type': 'text'},
        {'key': 'imei1', 'label': 'IMEI', 'type': 'text'},
        {'key': 'tiene_esim', 'label': 'Tiene eSIM', 'type': 'boolean'},
        {'key': 'cpu', 'label': 'Procesador', 'type': 'text'},
        {'key': 'ram_gb', 'label': 'RAM (GB)', 'type': 'number'},
        {'key': 'almacenamiento_gb', 'label': 'Almacenamiento (GB)', 'type': 'number'},
        {'key': 'sistema_operativo', 'label': 'Sistema operativo', 'type': 'select',
         'options': ['Android', 'iPadOS', 'Windows', 'Otro']},
        {'key': 'estado_general', 'label': 'Estado general (1–5)', 'type': 'scale', 'min': 1, 'max': 5},
    ],
    'Impresora': [
        {'key': 'tipo_conexion', 'label': 'Tipo conexión', 'type': 'select',
         'options': ['USB', 'Red (Ethernet)', 'WiFi', 'Bluetooth', 'USB + WiFi', 'USB + Red']},
        {'key': 'tipo_impresion', 'label': 'Tipo impresión', 'type': 'select',
         'options': ['Láser', 'Inyección de tinta', 'Sistema continuo (CISS)', 'Cartucho', 'Térmica', 'Matricial']},
        {'key': 'imprime_color', 'label': 'Imprime color', 'type': 'boolean'},
        {'key': 'duplex', 'label': 'Impresión doble cara', 'type': 'boolean'},
        {'key': 'formato_maximo', 'label': 'Formato máximo', 'type': 'select',
         'options': ['A4', 'A3', 'Carta', 'Legal', 'A3+']},
        {'key': 'estado_general', 'label': 'Estado general (1–5)', 'type': 'scale', 'min': 1, 'max': 5},
    ],
    'Monitor': [
        {'key': 'pantalla_pulgadas', 'label': 'Pantalla (pulg.)', 'type': 'text'},
        {'key': 'resolucion', 'label': 'Resolución', 'type': 'select',
         'options': ['HD 1280×720', 'Full HD 1920×1080', 'QHD 2560×1440', '4K 3840×2160', 'Otro']},
        {'key': 'tipo_panel', 'label': 'Tipo panel', 'type': 'select',
         'options': ['IPS', 'TN', 'VA', 'OLED', 'QLED', 'Otro']},
        {'key': 'tasa_refresco_hz', 'label': 'Tasa refresco (Hz)', 'type': 'number'},
        {'key': 'conexiones', 'label': 'Conexiones', 'type': 'text', 'placeholder': 'Ej: HDMI, DisplayPort, VGA'},
        {'key': 'estado_general', 'label': 'Estado general (1–5)', 'type': 'scale', 'min': 1, 'max': 5},
    ],
    'Cámara': [
        {'key': 'tipo_camara', 'label': 'Tipo', 'type': 'select',
         'options': ['IP/CCTV', 'Web', 'DSLR', 'Mirrorless', 'Acción', 'PTZ', 'Otro']},
        {'key': 'resolucion_mp', 'label': 'Resolución (MP / líneas TVL)', 'type': 'text'},
        {'key': 'tipo_conexion', 'label': 'Conexión', 'type': 'select',
         'options': ['USB', 'WiFi', 'Ethernet', 'BNC coaxial', 'PoE', 'Otro']},
        {'key': 'estado_general', 'label': 'Estado general (1–5)', 'type': 'scale', 'min': 1, 'max': 5},
    ],
    'Audífonos': [
        {'key': 'tipo_conexion', 'label': 'Conexión', 'type': 'select',
         'options': ['USB', '3.5mm', 'Bluetooth', 'USB-C', '2.4GHz inalámbrico']},
        {'key': 'con_microfono', 'label': 'Con micrófono', 'type': 'boolean'},
        {'key': 'cancelacion_ruido', 'label': 'Cancelación de ruido activa', 'type': 'boolean'},
        {'key': 'estado_general', 'label': 'Estado general (1–5)', 'type': 'scale', 'min': 1, 'max': 5},
    ],
    'Red': [
        {'key': 'tipo_dispositivo', 'label': 'Tipo', 'type': 'select',
         'options': ['Router', 'Switch', 'Access Point', 'Firewall/UTM', 'Módem', 'Patch Panel', 'NAS', 'UPS', 'Otro']},
        {'key': 'puertos', 'label': 'N° de puertos', 'type': 'number'},
        {'key': 'velocidad', 'label': 'Velocidad', 'type': 'select',
         'options': ['10/100 Mbps', '10/100/1000 Mbps (Gigabit)', '2.5 Gbps', '10 Gbps', 'Otro']},
        {'key': 'poe', 'label': 'Soporte PoE', 'type': 'boolean'},
        {'key': 'estado_general', 'label': 'Estado general (1–5)', 'type': 'scale', 'min': 1, 'max': 5},
    ],
    'Servidor': [
        {'key': 'cpu', 'label': 'Procesador', 'type': 'text', 'placeholder': 'Ej: Intel Xeon E5-2630 v4'},
        {'key': 'nucleos', 'label': 'Núcleos / Hilos', 'type': 'text', 'placeholder': 'Ej: 10C / 20T'},
        {'key': 'ram_gb', 'label': 'RAM (GB)', 'type': 'number'},
        {'key': 'almacenamiento', 'label': 'Almacenamiento', 'type': 'text', 'placeholder': 'Ej: 4×2 TB SAS'},
        {'key': 'raid', 'label': 'Configuración RAID', 'type': 'text'},
        {'key': 'sistema_operativo', 'label': 'Sistema operativo', 'type': 'text'},
        {'key': 'form_factor', 'label': 'Factor de forma', 'type': 'select',
         'options': ['Tower', 'Rack 1U', 'Rack 2U', 'Rack 4U', 'Blade', 'Mini']},
        {'key': 'estado_general', 'label': 'Estado general (1–5)', 'type': 'scale', 'min': 1, 'max': 5},
    ],
    'Accesorio': [
        {'key': 'descripcion_tecnica', 'label': 'Descripción técnica', 'type': 'text'},
        {'key': 'tipo_conexion', 'label': 'Conexión', 'type': 'text', 'placeholder': 'Ej: USB-A, USB-C, inalámbrico'},
        {'key': 'estado_general', 'label': 'Estado general (1–5)', 'type': 'scale', 'min': 1, 'max': 5},
    ],
    'Otro': [
        {'key': 'descripcion_tecnica', 'label': 'Descripción técnica', 'type': 'text'},
        {'key': 'estado_general', 'label': 'Estado general (1–5)', 'type': 'scale', 'min': 1, 'max': 5},
    ],
}

# Equipment types that can act as parent (hold peripherals)
TIPOS_PADRES = {'Portátil', 'Celular', 'Tablet', 'Servidor', 'Monitor', 'Otro'}
