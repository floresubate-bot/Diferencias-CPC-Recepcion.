import os
import glob
import pandas as pd
import sqlite3
from flask import Flask, render_template, jsonify, request

import sys

if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DB_PATH = os.path.join(BASE_DIR, 'history.db')
SOURCE_DIR = BASE_DIR

app = Flask(__name__, 
            template_folder=os.path.join(BASE_DIR, 'templates'),
            static_folder=os.path.join(BASE_DIR, 'static'))

# Block Area Mapping Lists
CLZ1_BLOCKS = ['6', '9', '17', '7a', '7A']
CLZ2_BLOCKS = ['10', '11', '19', '7b', '7B']
CLZ3_BLOCKS = ['4', '8', '5a', '5b', '5A', '5B']
SEZ_BLOCKS = ['2', '3', '21', '23', '24', '30', '31']
SAZ_BLOCKS = ['1', '12', '25', '26', '27', '28', '29']
LMZ_BLOCKS = ['14', '16', '18', '20', '22', '32', '33', '34', '35', '36', '37']

def get_area_for_block(block_name):
    if not block_name:
        return 'OTRAS'
    b = str(block_name).lower().strip()
    if b.startswith('0') and len(b) > 1:
        b = b[1:]
    if b in ['6', '9', '17', '7a']: return 'CLZ-1'
    if b in ['10', '11', '19', '7b']: return 'CLZ-2'
    if b in ['4', '8', '5a', '5b']: return 'CLZ-3'
    if b in ['2', '3', '21', '23', '24', '30', '31']: return 'SEZ'
    if b in ['1', '12', '25', '26', '27', '28', '29']: return 'SAZ'
    if b in ['14', '16', '18', '20', '22', '32', '33', '34', '35', '36', '37']: return 'LMZ'
    return 'OTRAS'

# Sort key helper for block sorting (numeric and alphanumeric)
def block_sort_key(block_val):
    if block_val is None:
        return (2, "")
    val = str(block_val).strip()
    if not val:
        return (2, "")
    try:
        # If block is strictly numeric, convert to int
        numeric_val = int(val)
        return (0, numeric_val)
    except ValueError:
        # If alphanumeric (like 5A, 7B), split if possible
        import re
        m = re.match(r"(\d+)([a-zA-Z]+)", val)
        if m:
            return (1, (int(m.group(1)), m.group(2).upper()))
        return (2, val.upper())

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create main records table with standardized column names
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TEXT,
            semana INTEGER,
            flor TEXT,
            variedad TEXT,
            bloque TEXT,
            color TEXT,
            cpc REAL,
            recepcion REAL,
            cpc_reception_diff REAL,
            source_file TEXT,
            UNIQUE(semana, flor, variedad, bloque, color, fecha)
        )
    """)
    
    conn.commit()
    conn.close()

def load_excel_to_sqlite(file_path):
    print(f"Loading {file_path}...")
    try:
        xls = pd.ExcelFile(file_path)
        sheet_names = xls.sheet_names
        
        db_records = []
        
        for sheet in sheet_names:
            df = pd.read_excel(file_path, sheet_name=sheet)
            
            # Clean column names to find matches
            df.columns = [str(c).strip() for c in df.columns]
            
            col_mapping = {}
            for col in df.columns:
                c_low = col.lower()
                
                # Check CPC differences FIRST before general cpc
                if 'fecha' in c_low or 'date' in c_low:
                    col_mapping['fecha'] = col
                elif 'semana' in c_low or 'week' in c_low:
                    col_mapping['semana'] = col
                elif 'flor' in c_low or 'flower' in c_low:
                    col_mapping['flor'] = col
                elif 'variedad' in c_low or 'variety' in c_low:
                    col_mapping['variedad'] = col
                elif 'bloque' in c_low or 'block' in c_low:
                    col_mapping['bloque'] = col
                elif 'color' in c_low:
                    col_mapping['color'] = col
                elif 'difference' in c_low or 'diff' in c_low:
                    col_mapping['cpc_reception_diff'] = col
                elif 'cpc' in c_low or 'pilotos' in c_low:
                    col_mapping['cpc'] = col
                elif 'recep' in c_low:
                    col_mapping['recepcion'] = col
            
            # Ensure mandatory fields are present
            required = ['fecha', 'semana', 'flor', 'bloque', 'cpc', 'recepcion']
            missing = [r for r in required if r not in col_mapping]
            if missing:
                print(f"  Skipping sheet '{sheet}': missing columns {missing}")
                continue
                
            # Keep and rename columns
            rename_dict = {col_mapping[k]: k for k in col_mapping}
            df_cleaned = df[list(col_mapping.values())].rename(columns=rename_dict)
            
            # Add fallback fields if missing
            if 'cpc_reception_diff' not in df_cleaned.columns:
                df_cleaned['cpc_reception_diff'] = df_cleaned['cpc'] - df_cleaned['recepcion']
            if 'color' not in df_cleaned.columns:
                df_cleaned['color'] = 'Mixed'
            if 'variedad' not in df_cleaned.columns:
                df_cleaned['variedad'] = 'Mixed'
                
            # Clean values
            df_cleaned['cpc'] = pd.to_numeric(df_cleaned['cpc'], errors='coerce').fillna(0.0)
            df_cleaned['recepcion'] = pd.to_numeric(df_cleaned['recepcion'], errors='coerce').fillna(0.0)
            df_cleaned['cpc_reception_diff'] = pd.to_numeric(df_cleaned['cpc_reception_diff'], errors='coerce').fillna(0.0)
            df_cleaned['bloque'] = df_cleaned['bloque'].astype(str).str.strip()
            df_cleaned['flor'] = df_cleaned['flor'].astype(str).str.strip().str.lower()
            df_cleaned['variedad'] = df_cleaned['variedad'].astype(str).str.strip()
            df_cleaned['color'] = df_cleaned['color'].astype(str).str.strip()
            
            # Parse Dates
            df_cleaned['fecha'] = pd.to_datetime(df_cleaned['fecha'], errors='coerce')
            df_cleaned = df_cleaned.dropna(subset=['fecha'])
            df_cleaned['fecha'] = df_cleaned['fecha'].dt.strftime('%Y-%m-%d')
            
            df_cleaned['semana'] = pd.to_numeric(df_cleaned['semana'], errors='coerce')
            df_cleaned = df_cleaned.dropna(subset=['semana'])
            df_cleaned['semana'] = df_cleaned['semana'].astype(int)
            
            df_cleaned['source_file'] = os.path.basename(file_path)
            
            db_records.append(df_cleaned)
            
        if db_records:
            final_df = pd.concat(db_records, ignore_index=True)
            
            conn = sqlite3.connect(DB_PATH)
            # Insert or replace duplicates to keep history unified
            for _, row in final_df.iterrows():
                conn.execute("""
                    INSERT OR REPLACE INTO records 
                    (fecha, semana, flor, variedad, bloque, color, cpc, recepcion, cpc_reception_diff, source_file)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    row['fecha'], int(row['semana']), row['flor'], row['variedad'],
                    row['bloque'], row['color'], float(row['cpc']), float(row['recepcion']),
                    float(row['cpc_reception_diff']), row['source_file']
                ))
            conn.commit()
            conn.close()
            print(f"  Loaded {len(final_df)} records successfully.")
            
    except Exception as e:
        print(f"  Error loading {file_path}: {e}")
        import traceback
        traceback.print_exc()

def scan_and_load_excel_files():
    # Scan SOURCE_DIR for Excel files
    excel_files = glob.glob(os.path.join(SOURCE_DIR, "*.xlsx"))
    excel_files += glob.glob(os.path.join(SOURCE_DIR, "*.xls"))
    
    # Check if we already have records
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM records")
    count = cursor.fetchone()[0]
    conn.close()
    
    if count > 0:
        print(f"Database already contains {count} records. Skipping pre-load.")
        return
        
    print(f"Found {len(excel_files)} Excel files. Initializing load...")
    for f in excel_files:
        load_excel_to_sqlite(f)

# Initialize PWA / standalone main page route
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/data', methods=['GET'])
def get_data_filters():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Get unique weeks
        cursor.execute("SELECT DISTINCT semana FROM records ORDER BY semana DESC")
        semanas = [r[0] for r in cursor.fetchall() if r[0]]
        
        # Get unique flowers
        cursor.execute("SELECT DISTINCT flor FROM records ORDER BY flor ASC")
        flores = [r[0] for r in cursor.fetchall() if r[0]]
        
        conn.close()
        return jsonify({
            'semanas': semanas,
            'flores': flores
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/report', methods=['GET'])
def get_report():
    semana = request.args.get('semana', type=int)
    flor = request.args.get('flor', type=str)
    variedad = request.args.get('variedad', type=str)
    bloque = request.args.get('bloque', type=str)
    
    if not semana or not flor:
        return jsonify({'error': 'Faltan parámetros semana y/o flor'}), 400
        
    try:
        conn = sqlite3.connect(DB_PATH)
        
        query = "SELECT fecha, bloque, cpc, recepcion, cpc_reception_diff, flor, variedad, color FROM records WHERE semana = ? AND flor = ?"
        params = [semana, flor]
        
        if variedad and variedad.lower() != 'todas' and variedad.strip() != '':
            query += " AND variedad = ?"
            params.append(variedad)
            
        if bloque and bloque.lower() != 'todos' and bloque.strip() != '':
            query += " AND bloque = ?"
            params.append(bloque)
            
        df = pd.read_sql_query(query, conn, params=params)
        conn.close()
        
        if df.empty:
            return jsonify({
                'detail': [],
                'acumulado': [],
                'areas': [],
                'totals': {'pilotos': 0, 'recepcion': 0, 'cumplimiento': 0}
            })
            
        # 1. Detailed Pivot Table Rows
        detail_data = []
        for _, row in df.iterrows():
            detail_data.append({
                'fecha': row['fecha'],
                'bloque': row['bloque'],
                'cpc': float(row['cpc']),
                'recepcion': float(row['recepcion']),
                'cpc_reception_diff': float(row['cpc_reception_diff'])
            })
        
        # Sort detail rows by date then block using helper
        detail_data.sort(key=lambda x: (x['fecha'], block_sort_key(x['bloque'])))
            
        # 2. Block Accumulated Table Rows
        df_acum = df.groupby('bloque').agg({
            'cpc': 'sum',
            'recepcion': 'sum'
        }).reset_index()
        
        acumulado_data = []
        total_cpc = 0.0
        total_recep = 0.0
        
        for _, row in df_acum.iterrows():
            b_name = row['bloque']
            cpc_val = float(row['cpc'])
            recep_val = float(row['recepcion'])
            compliance = round((cpc_val / recep_val) * 100) if recep_val > 0 else 0
            
            total_cpc += cpc_val
            total_recep += recep_val
            
            acumulado_data.append({
                'bloque': b_name,
                'pilotos': cpc_val,
                'recepcion': recep_val,
                'cumplimiento': compliance
            })
            
        # Sort accumulated blocks using helper
        acumulado_data.sort(key=lambda x: block_sort_key(x['bloque']))
            
        # 3. Compliance by Area
        area_sums = {}
        for _, row in df.iterrows():
            block_name = row['bloque']
            area_name = get_area_for_block(block_name)
            
            if area_name:
                if area_name not in area_sums:
                    area_sums[area_name] = {'pilotos': 0.0, 'recepcion': 0.0}
                area_sums[area_name]['pilotos'] += float(row['cpc'])
                area_sums[area_name]['recepcion'] += float(row['recepcion'])
                
        areas_data = []
        for area_name, values in sorted(area_sums.items()):
            pil = values['pilotos']
            rec = values['recepcion']
            comp = 0.0
            if rec > 0:
                comp = round((pil / rec) * 100, 1)
            areas_data.append({
                'area': area_name,
                'pilotos': pil,
                'recepcion': rec,
                'cumplimiento': comp
            })
            
        total_blocks = len(acumulado_data)
        compliant_blocks = sum(1 for b in acumulado_data if 95 <= b['cumplimiento'] <= 110)
        efectividad = round((compliant_blocks / total_blocks) * 100, 1) if total_blocks > 0 else 0.0

        return jsonify({
            'detail': detail_data,
            'acumulado': acumulado_data,
            'areas': areas_data,
            'totals': {
                'pilotos': total_cpc,
                'recepcion': total_recep,
                'cumplimiento': round((total_cpc / total_recep * 100)) if total_recep > 0 else 0,
                'total_bloques': total_blocks,
                'bloques_cumplidos': compliant_blocks,
                'efectividad_bloques': efectividad
            }
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/variedades', methods=['GET'])
def get_varieties():
    flor = request.args.get('flor', type=str)
    if not flor:
        return jsonify({'error': 'Falta el parámetro flor'}), 400
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT variedad FROM records WHERE flor = ? ORDER BY variedad ASC", (flor,))
        varieties = [r[0] for r in cursor.fetchall() if r[0]]
        conn.close()
        return jsonify({'variedades': varieties})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/bloques', methods=['GET'])
def get_blocks():
    flor = request.args.get('flor', type=str)
    if not flor:
        return jsonify({'error': 'Falta el parámetro flor'}), 400
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT bloque FROM records WHERE flor = ? ORDER BY bloque ASC", (flor,))
        blocks = [r[0] for r in cursor.fetchall() if r[0]]
        conn.close()
        return jsonify({'bloques': blocks})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/history', methods=['GET'])
def get_history():
    flor = request.args.get('flor', type=str)
    variedad = request.args.get('variedad', type=str)
    bloque = request.args.get('bloque', type=str)
    
    if not flor:
        return jsonify({'error': 'Falta el parámetro flor'}), 400
        
    try:
        conn = sqlite3.connect(DB_PATH)
        
        query = "SELECT semana, SUM(cpc) as pilotos, SUM(recepcion) as recepcion FROM records WHERE flor = ?"
        params = [flor]
        
        if variedad and variedad.lower() != 'todas' and variedad.strip() != '':
            query += " AND variedad = ?"
            params.append(variedad)
            
        if bloque and bloque.lower() != 'todos' and bloque.strip() != '':
            query += " AND bloque = ?"
            params.append(bloque)
            
        query += " GROUP BY semana ORDER BY semana ASC"
            
        df = pd.read_sql_query(query, conn, params=params)
        conn.close()
        
        history_data = []
        for _, row in df.iterrows():
            pil = float(row['pilotos'])
            rec = float(row['recepcion'])
            comp = 0.0
            if rec > 0:
                comp = round((pil / rec) * 100, 1)
            history_data.append({
                'semana': int(row['semana']),
                'pilotos': pil,
                'recepcion': rec,
                'cumplimiento': comp
            })
            
        return jsonify({'history': history_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/anomalies', methods=['GET'])
def get_anomalies():
    semana = request.args.get('semana', type=int)
    flor = request.args.get('flor', type=str)
    variedad = request.args.get('variedad', type=str)
    bloque = request.args.get('bloque', type=str)
    
    if not semana or not flor:
        return jsonify({'error': 'Faltan parámetros semana y/o flor'}), 400
        
    try:
        conn = sqlite3.connect(DB_PATH)
        
        query = "SELECT fecha, bloque, cpc, recepcion, cpc_reception_diff, flor, variedad, color FROM records WHERE semana = ? AND flor = ?"
        params = [semana, flor]
        
        if variedad and variedad.lower() != 'todas' and variedad.strip() != '':
            query += " AND variedad = ?"
            params.append(variedad)
            
        if bloque and bloque.lower() != 'todos' and bloque.strip() != '':
            query += " AND bloque = ?"
            params.append(bloque)
            
        df = pd.read_sql_query(query, conn, params=params)
        conn.close()
        
        if df.empty:
            return jsonify({'anomalies': []})
            
        df_block = df.groupby('bloque').agg({
            'cpc': 'sum',
            'recepcion': 'sum'
        }).reset_index()
        
        anomalous_blocks = []
        
        for _, row in df_block.iterrows():
            bloque = row['bloque']
            pilotos = float(row['cpc'])
            recepcion = float(row['recepcion'])
            
            if pilotos == 0 and recepcion == 0:
                continue
                
            compliance = 0.0
            if recepcion > 0:
                compliance = round((pilotos / recepcion) * 100, 1)
                
            area_name = get_area_for_block(bloque)
            
            # Check 1: Is overall block out of range?
            is_general_anomaly = compliance < 95.0 or compliance > 110.0
            
            df_b = df[df['bloque'] == bloque]
            
            # Check 2: Even if overall compliance is in range, do individual varieties inside the block deviate?
            df_var = df_b.groupby('variedad').agg({'cpc': 'sum', 'recepcion': 'sum'}).reset_index()
            df_var['diff'] = df_var['cpc'] - df_var['recepcion']
            df_var['diff_abs'] = df_var['diff'].abs()
            
            variedades_criticas = []
            for _, vr in df_var.iterrows():
                v_name = vr['variedad'] if vr['variedad'] else "Sin variedad"
                v_pil = float(vr['cpc'])
                v_rec = float(vr['recepcion'])
                v_diff = vr['diff']
                
                if v_pil == 0 and v_rec == 0:
                    continue
                    
                v_comp = round((v_pil / v_rec) * 100) if v_rec > 0 else 0
                if v_comp < 95 or v_comp > 110:
                    variedades_criticas.append({
                        'variedad': v_name,
                        'pilotos': v_pil,
                        'recepcion': v_rec,
                        'diferencia': v_diff,
                        'cumplimiento': v_comp
                    })
            
            # Flag block if it has general anomaly OR if it is compliant but has internal critical varieties
            if is_general_anomaly or (95.0 <= compliance <= 110.0 and len(variedades_criticas) > 0):
                # 1. Critical Days (compliance < 95% or > 110%)
                df_day = df_b.groupby('fecha').agg({'cpc': 'sum', 'recepcion': 'sum'}).reset_index()
                critical_days_list = []
                for _, day_row in df_day.iterrows():
                    d_date = day_row['fecha']
                    d_pil = float(day_row['cpc'])
                    d_rec = float(day_row['recepcion'])
                    
                    if d_pil == 0 and d_rec == 0:
                        continue
                        
                    d_comp = round((d_pil / d_rec) * 100) if d_rec > 0 else 0
                    if d_comp < 95 or d_comp > 110:
                        parts = d_date.split('-')
                        d_date_formatted = f"{int(parts[2])}/{int(parts[1])}/{parts[0]}" if len(parts) == 3 else d_date
                        d_diff = d_pil - d_rec
                        critical_days_list.append({
                            'fecha': d_date_formatted,
                            'pilotos': d_pil,
                            'recepcion': d_rec,
                            'diferencia': d_diff,
                            'cumplimiento': d_comp
                        })
                
                # 2. top varieties (general list for the whole block)
                df_var_all = df_b.groupby('variedad').agg({'cpc': 'sum', 'recepcion': 'sum'}).reset_index()
                df_var_all['diff'] = df_var_all['cpc'] - df_var_all['recepcion']
                df_var_all['diff_abs'] = df_var_all['diff'].abs()
                top_vars = df_var_all.sort_values(by='diff_abs', ascending=False).head(3)
                vars_list = []
                for _, vr in top_vars.iterrows():
                    v_name = vr['variedad'] if vr['variedad'] else "Sin variedad"
                    v_pil = float(vr['cpc'])
                    v_rec = float(vr['recepcion'])
                    v_diff = vr['diff']
                    v_comp = round((v_pil / v_rec) * 100) if v_rec > 0 else 0
                    vars_list.append({
                        'variedad': v_name,
                        'pilotos': v_pil,
                        'recepcion': v_rec,
                        'diferencia': v_diff,
                        'cumplimiento': v_comp
                    })
                
                tipo_alerta = 'general' if is_general_anomaly else 'interna'
                
                # LIMIT TO TOP 3 CRITICAL VARIETIES ONLY as requested by the user
                variedades_criticas_sorted = sorted(variedades_criticas, key=lambda x: abs(x['diferencia']), reverse=True)[:3]
                
                anomalous_blocks.append({
                    'bloque': bloque,
                    'area': area_name,
                    'tipo_alerta': tipo_alerta,
                    'pilotos': pilotos,
                    'recepcion': recepcion,
                    'cumplimiento': compliance,
                    'critical_days': critical_days_list,
                    'top_varieties': vars_list,
                    'variedades_criticas': variedades_criticas_sorted
                })
                
        return jsonify({'anomalies': anomalous_blocks})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/upload', methods=['POST'])
def upload_files():
    if 'files[]' not in request.files:
        return jsonify({'error': 'No se enviaron archivos'}), 400
        
    uploaded_files = request.files.getlist('files[]')
    
    if not uploaded_files or uploaded_files[0].filename == '':
        return jsonify({'error': 'No se seleccionaron archivos'}), 400
        
    # Create a temp uploads directory if not exists
    upload_temp = os.path.join(BASE_DIR, 'uploads_temp')
    os.makedirs(upload_temp, exist_ok=True)
    
    success_count = 0
    errors = []
    
    for file in uploaded_files:
        file_path = os.path.join(upload_temp, file.filename)
        try:
            file.save(file_path)
            # Load records into the database
            load_excel_to_sqlite(file_path)
            # Clean up temp file
            os.remove(file_path)
            success_count += 1
        except Exception as e:
            errors.append(f"{file.filename}: {str(e)}")
            
    if success_count > 0:
        msg = f"Se cargaron con éxito {success_count} archivo(s)."
        if errors:
            msg += f" Errores: {', '.join(errors)}"
        return jsonify({'success': True, 'message': msg})
    else:
        return jsonify({'success': False, 'error': f"Error al cargar archivos: {', '.join(errors)}"})

if __name__ == '__main__':
    import webbrowser
    from threading import Timer
    
    port = int(os.environ.get("PORT", 5001))
    
    def open_browser():
        webbrowser.open_new(f"http://127.0.0.1:{port}")
        
    init_db()
    scan_and_load_excel_files()
    
    # Only open browser on main process startup locally (not on Render cloud)
    if os.environ.get("WERKZEUG_RUN_MAIN") != "true" and not os.environ.get("PORT"):
        Timer(1.5, open_browser).start()
        
    app.run(host='0.0.0.0', port=port, debug=True)
