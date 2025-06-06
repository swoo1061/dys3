import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import subprocess
import threading
import os
import sys
import json
import webbrowser
import time
from pathlib import Path
import shutil
import psutil
from PIL import Image, ImageTk
import pystray
from pystray import MenuItem as item
import requests

class InspectionServerManager:
    def __init__(self):
        # 기본 설정
        self.config_file = "server_config.json"
        self.load_config()
        
        # 서버 상태
        self.server_process = None
        self.server_running = False
        
        # GUI 설정
        self.setup_gui()
        self.setup_tray()
        
        # 자동 시작 체크
        if self.config.get('auto_start', False):
            self.start_server()
    
    def load_config(self):
        """설정 파일 로드"""
        default_config = {
            'server_port': 3000,
            'uploads_path': os.path.join(os.getcwd(), 'public', 'uploads'),
            'data_path': os.path.join(os.getcwd(), 'data'),
            'auto_start': False,
            'minimize_to_tray': True,
            'auto_open_browser': True
        }
        
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    self.config = {**default_config, **json.load(f)}
            else:
                self.config = default_config
                self.save_config()
        except Exception as e:
            print(f"설정 로드 오류: {e}")
            self.config = default_config
    
    def save_config(self):
        """설정 파일 저장"""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"설정 저장 오류: {e}")
    
    def setup_gui(self):
        """GUI 설정"""
        self.root = tk.Tk()
        self.root.title("건축 현장 업무 검수 시스템 - 서버 관리자")
        self.root.geometry("600x700")
        self.root.resizable(True, True)
        
        # 윈도우 닫기 이벤트 처리
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        
        # 메인 프레임
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 서버 상태 프레임
        status_frame = ttk.LabelFrame(main_frame, text="서버 상태", padding="10")
        status_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        self.status_label = ttk.Label(status_frame, text="서버 중지됨", font=("Arial", 12, "bold"))
        self.status_label.grid(row=0, column=0, sticky=tk.W)
        
        self.port_label = ttk.Label(status_frame, text=f"포트: {self.config['server_port']}")
        self.port_label.grid(row=1, column=0, sticky=tk.W)
        
        # 서버 제어 버튼
        button_frame = ttk.Frame(main_frame)
        button_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        self.start_button = ttk.Button(button_frame, text="서버 시작", command=self.start_server)
        self.start_button.grid(row=0, column=0, padx=(0, 5))
        
        self.stop_button = ttk.Button(button_frame, text="서버 중지", command=self.stop_server, state="disabled")
        self.stop_button.grid(row=0, column=1, padx=5)
        
        self.restart_button = ttk.Button(button_frame, text="서버 재시작", command=self.restart_server, state="disabled")
        self.restart_button.grid(row=0, column=2, padx=5)
        
        self.browser_button = ttk.Button(button_frame, text="브라우저 열기", command=self.open_browser)
        self.browser_button.grid(row=0, column=3, padx=(5, 0))
        
        # 설정 프레임
        config_frame = ttk.LabelFrame(main_frame, text="설정", padding="10")
        config_frame.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # 포트 설정
        ttk.Label(config_frame, text="서버 포트:").grid(row=0, column=0, sticky=tk.W, pady=2)
        self.port_var = tk.StringVar(value=str(self.config['server_port']))
        port_entry = ttk.Entry(config_frame, textvariable=self.port_var, width=10)
        port_entry.grid(row=0, column=1, sticky=tk.W, padx=(10, 0), pady=2)
        
        # 업로드 폴더 설정
        ttk.Label(config_frame, text="업로드 폴더:").grid(row=1, column=0, sticky=tk.W, pady=2)
        self.uploads_var = tk.StringVar(value=self.config['uploads_path'])
        uploads_entry = ttk.Entry(config_frame, textvariable=self.uploads_var, width=40)
        uploads_entry.grid(row=1, column=1, sticky=(tk.W, tk.E), padx=(10, 5), pady=2)
        
        uploads_button = ttk.Button(config_frame, text="찾아보기", 
                                  command=lambda: self.browse_folder(self.uploads_var))
        uploads_button.grid(row=1, column=2, padx=(0, 0), pady=2)
        
        # 데이터 폴더 설정
        ttk.Label(config_frame, text="데이터 폴더:").grid(row=2, column=0, sticky=tk.W, pady=2)
        self.data_var = tk.StringVar(value=self.config['data_path'])
        data_entry = ttk.Entry(config_frame, textvariable=self.data_var, width=40)
        data_entry.grid(row=2, column=1, sticky=(tk.W, tk.E), padx=(10, 5), pady=2)
        
        data_button = ttk.Button(config_frame, text="찾아보기", 
                               command=lambda: self.browse_folder(self.data_var))
        data_button.grid(row=2, column=2, padx=(0, 0), pady=2)
        
        # 체크박스 옵션들
        self.auto_start_var = tk.BooleanVar(value=self.config['auto_start'])
        auto_start_check = ttk.Checkbutton(config_frame, text="프로그램 시작 시 서버 자동 시작", 
                                         variable=self.auto_start_var)
        auto_start_check.grid(row=3, column=0, columnspan=3, sticky=tk.W, pady=5)
        
        self.minimize_tray_var = tk.BooleanVar(value=self.config['minimize_to_tray'])
        minimize_check = ttk.Checkbutton(config_frame, text="닫기 버튼 클릭 시 트레이로 최소화", 
                                       variable=self.minimize_tray_var)
        minimize_check.grid(row=4, column=0, columnspan=3, sticky=tk.W, pady=2)
        
        self.auto_browser_var = tk.BooleanVar(value=self.config['auto_open_browser'])
        browser_check = ttk.Checkbutton(config_frame, text="서버 시작 시 자동으로 브라우저 열기", 
                                      variable=self.auto_browser_var)
        browser_check.grid(row=5, column=0, columnspan=3, sticky=tk.W, pady=2)
        
        # 설정 저장 버튼
        save_config_button = ttk.Button(config_frame, text="설정 저장", command=self.save_settings)
        save_config_button.grid(row=6, column=0, columnspan=3, pady=(10, 0))
        
        # 파일 관리 프레임
        file_frame = ttk.LabelFrame(main_frame, text="파일 관리", padding="10")
        file_frame.grid(row=3, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        ttk.Button(file_frame, text="업로드 폴더 열기", 
                  command=self.open_uploads_folder).grid(row=0, column=0, padx=(0, 5), pady=2)
        
        ttk.Button(file_frame, text="데이터 폴더 열기", 
                  command=self.open_data_folder).grid(row=0, column=1, padx=5, pady=2)
        
        ttk.Button(file_frame, text="로그 보기", 
                  command=self.show_logs).grid(row=0, column=2, padx=(5, 0), pady=2)
        
        # 로그 출력 영역
        log_frame = ttk.LabelFrame(main_frame, text="로그", padding="10")
        log_frame.grid(row=4, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))
        
        # 스크롤바가 있는 텍스트 위젯
        log_text_frame = ttk.Frame(log_frame)
        log_text_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        self.log_text = tk.Text(log_text_frame, height=15, wrap=tk.WORD)
        scrollbar = ttk.Scrollbar(log_text_frame, orient="vertical", command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=scrollbar.set)
        
        self.log_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))
        
        # 그리드 가중치 설정
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        main_frame.rowconfigure(4, weight=1)
        config_frame.columnconfigure(1, weight=1)
        log_frame.columnconfigure(0, weight=1)
        log_frame.rowconfigure(0, weight=1)
        log_text_frame.columnconfigure(0, weight=1)
        log_text_frame.rowconfigure(0, weight=1)
        
        # 초기 로그 메시지
        self.log_message("서버 관리자가 시작되었습니다.")
    
    def setup_tray(self):
        """시스템 트레이 설정"""
        try:
            # 간단한 아이콘 생성
            image = Image.new('RGB', (64, 64), color='blue')
            
            menu = pystray.Menu(
                item('서버 시작', self.start_server, enabled=lambda item: not self.server_running),
                item('서버 중지', self.stop_server, enabled=lambda item: self.server_running),
                item('브라우저 열기', self.open_browser),
                pystray.Menu.SEPARATOR,
                item('창 보이기', self.show_window),
                item('종료', self.quit_app)
            )
            
            self.tray_icon = pystray.Icon("inspection_system", image, "건축 현장 업무 검수 시스템", menu)
        except Exception as e:
            print(f"트레이 아이콘 설정 오류: {e}")
            self.tray_icon = None
    
    def log_message(self, message):
        """로그 메시지 추가"""
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] {message}\n"
        
        self.log_text.insert(tk.END, log_entry)
        self.log_text.see(tk.END)
        print(log_entry.strip())  # 콘솔에도 출력
    
    def start_server(self):
        """서버 시작"""
        if self.server_running:
            self.log_message("서버가 이미 실행 중입니다.")
            return
        
        try:
            # 필요한 폴더 생성
            os.makedirs(self.config['uploads_path'], exist_ok=True)
            os.makedirs(self.config['data_path'], exist_ok=True)
            
            # 환경 변수 설정
            env = os.environ.copy()
            env['PORT'] = str(self.config['server_port'])
            env['NODE_ENV'] = 'production'  # 프로덕션 모드 설정
            
            # Next.js 서버 시작
            self.log_message("서버를 시작하는 중...")
            
            # 프로덕션 모드로 서버 시작
            cmd = ["npm", "start"]
            
            self.server_process = subprocess.Popen(
                cmd,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                cwd=os.getcwd()
            )
            
            # 서버 출력을 별도 스레드에서 모니터링
            threading.Thread(target=self.monitor_server_output, daemon=True).start()
            
            # 서버 상태 업데이트
            self.server_running = True
            self.update_ui_status()
            
            # 서버가 시작될 때까지 잠시 대기
            time.sleep(3)
            
            # 브라우저 자동 열기
            if self.config['auto_open_browser']:
                self.open_browser()
                
        except Exception as e:
            self.log_message(f"서버 시작 오류: {e}")
            messagebox.showerror("오류", f"서버 시작에 실패했습니다: {e}")
    
    def stop_server(self):
        """서버 중지"""
        if not self.server_running:
            self.log_message("서버가 실행되고 있지 않습니다.")
            return
        
        try:
            if self.server_process:
                self.log_message("서버를 중지하는 중...")
                
                # 프로세스 종료
                self.server_process.terminate()
                
                # 강제 종료가 필요한 경우
                try:
                    self.server_process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    self.server_process.kill()
                    self.log_message("서버를 강제로 종료했습니다.")
                
                self.server_process = None
            
            # 포트에서 실행 중인 프로세스 종료
            self.kill_process_on_port(self.config['server_port'])
            
            self.server_running = False
            self.update_ui_status()
            self.log_message("서버가 중지되었습니다.")
            
        except Exception as e:
            self.log_message(f"서버 중지 오류: {e}")
            messagebox.showerror("오류", f"서버 중지에 실패했습니다: {e}")
    
    def restart_server(self):
        """서버 재시작"""
        self.log_message("서버를 재시작합니다...")
        self.stop_server()
        time.sleep(2)
        self.start_server()
    
    def kill_process_on_port(self, port):
        """특정 포트에서 실행 중인 프로세스 종료"""
        try:
            for proc in psutil.process_iter(['pid', 'name', 'connections']):
                try:
                    connections = proc.info['connections']
                    for conn in connections:
                        if conn.laddr.port == port:
                            proc.terminate()
                            self.log_message(f"포트 {port}에서 실행 중인 프로세스(PID: {proc.pid})를 종료했습니다.")
                            return
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
        except Exception as e:
            self.log_message(f"포트 프로세스 종료 오류: {e}")
    
    def monitor_server_output(self):
        """서버 출력 모니터링"""
        try:
            while self.server_process and self.server_process.poll() is None:
                output = self.server_process.stdout.readline()
                if output:
                    try:
                        # UTF-8로 디코딩 시도
                        decoded_output = output.encode('cp949').decode('utf-8')
                    except UnicodeError:
                        # 실패하면 cp949로 디코딩
                        decoded_output = output.encode('cp949').decode('cp949', errors='replace')
                    
                    self.log_message(decoded_output.strip())
            
            if self.server_process:
                return_code = self.server_process.poll()
                if return_code != 0:
                    self.log_message(f"서버가 비정상 종료되었습니다. (종료 코드: {return_code})")
                self.server_running = False
                self.update_ui_status()
        except Exception as e:
            self.log_message(f"서버 모니터링 오류: {e}")
            self.server_running = False
            self.update_ui_status()
    
    def update_ui_status(self):
        """UI 상태 업데이트"""
        if self.server_running:
            self.status_label.config(text="서버 실행 중", foreground="green")
            self.start_button.config(state="disabled")
            self.stop_button.config(state="normal")
            self.restart_button.config(state="normal")
        else:
            self.status_label.config(text="서버 중지됨", foreground="red")
            self.start_button.config(state="normal")
            self.stop_button.config(state="disabled")
            self.restart_button.config(state="disabled")
        
        self.port_label.config(text=f"포트: {self.config['server_port']}")
    
    def open_browser(self):
        """브라우저에서 웹 애플리케이션 열기"""
        url = f"http://localhost:{self.config['server_port']}"
        webbrowser.open(url)
        self.log_message(f"브라우저에서 {url}을 열었습니다.")
    
    def browse_folder(self, var):
        """폴더 선택 다이얼로그"""
        folder = filedialog.askdirectory(initialdir=var.get())
        if folder:
            var.set(folder)
    
    def save_settings(self):
        """설정 저장"""
        try:
            # 포트 유효성 검사
            port = int(self.port_var.get())
            if not (1 <= port <= 65535):
                raise ValueError("포트는 1-65535 사이의 값이어야 합니다.")
            
            # 설정 업데이트
            self.config['server_port'] = port
            self.config['uploads_path'] = self.uploads_var.get()
            self.config['data_path'] = self.data_var.get()
            self.config['auto_start'] = self.auto_start_var.get()
            self.config['minimize_to_tray'] = self.minimize_tray_var.get()
            self.config['auto_open_browser'] = self.auto_browser_var.get()
            
            # 폴더 생성
            os.makedirs(self.config['uploads_path'], exist_ok=True)
            os.makedirs(self.config['data_path'], exist_ok=True)
            
            self.save_config()
            self.update_ui_status()
            
            self.log_message("설정이 저장되었습니다.")
            messagebox.showinfo("성공", "설정이 저장되었습니다.")
            
        except ValueError as e:
            messagebox.showerror("오류", f"설정 오류: {e}")
        except Exception as e:
            self.log_message(f"설정 저장 오류: {e}")
            messagebox.showerror("오류", f"설정 저장에 실패했습니다: {e}")
    
    def open_uploads_folder(self):
        """업로드 폴더 열기"""
        try:
            os.makedirs(self.config['uploads_path'], exist_ok=True)
            os.startfile(self.config['uploads_path'])
        except Exception as e:
            self.log_message(f"폴더 열기 오류: {e}")
            messagebox.showerror("오류", f"폴더를 열 수 없습니다: {e}")
    
    def open_data_folder(self):
        """데이터 폴더 열기"""
        try:
            os.makedirs(self.config['data_path'], exist_ok=True)
            os.startfile(self.config['data_path'])
        except Exception as e:
            self.log_message(f"폴더 열기 오류: {e}")
            messagebox.showerror("오류", f"폴더를 열 수 없습니다: {e}")
    
    def show_logs(self):
        """로그 창 표시"""
        log_window = tk.Toplevel(self.root)
        log_window.title("상세 로그")
        log_window.geometry("800x600")
        
        log_text = tk.Text(log_window, wrap=tk.WORD)
        scrollbar = ttk.Scrollbar(log_window, orient="vertical", command=log_text.yview)
        log_text.configure(yscrollcommand=scrollbar.set)
        
        log_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 현재 로그 내용 복사
        log_text.insert(tk.END, self.log_text.get(1.0, tk.END))
    
    def on_closing(self):
        """창 닫기 이벤트 처리"""
        if self.config['minimize_to_tray'] and self.tray_icon:
            self.root.withdraw()  # 창 숨기기
            if self.tray_icon:
                threading.Thread(target=self.tray_icon.run, daemon=True).start()
        else:
            self.quit_app()
    
    def show_window(self):
        """창 보이기"""
        self.root.deiconify()
        self.root.lift()
        if self.tray_icon:
            self.tray_icon.stop()
    
    def quit_app(self):
        """애플리케이션 종료"""
        if self.server_running:
            self.stop_server()
        
        if self.tray_icon:
            self.tray_icon.stop()
        
        self.root.quit()
        self.root.destroy()
    
    def run(self):
        """메인 실행 함수"""
        self.root.mainloop()

if __name__ == "__main__":
    app = InspectionServerManager()
    app.run()