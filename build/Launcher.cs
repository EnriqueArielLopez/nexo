using System;
using System.IO;
using System.Net;
using System.Diagnostics;
using System.Threading;
using System.Drawing;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using System.Text;
using System.Runtime.InteropServices;

static class Launcher {
    internal const string Url = "http://127.0.0.1:18761";
    static string Root = AppDomain.CurrentDomain.BaseDirectory;
    internal static bool IsNexoHealth(string json) {
        try {
            var health=new JavaScriptSerializer().DeserializeObject(json) as System.Collections.Generic.Dictionary<string,object>;
            return health!=null&&health.ContainsKey("app")&&object.Equals(health["app"],"nexo")&&health.ContainsKey("ok")&&object.Equals(health["ok"],true);
        } catch { return false; }
    }
    internal static bool Ready(int timeout=1200) { try { return IsNexoHealth(Read("/api/health",timeout)); } catch { return false; } }
    delegate bool EnumCallback(IntPtr h,IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumCallback callback,IntPtr l);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h,StringBuilder text,int count);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h,int cmd);
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h,uint message,IntPtr w,IntPtr l);
    static System.Collections.Generic.List<IntPtr> Windows(){var found=new System.Collections.Generic.List<IntPtr>();EnumWindows((h,l)=>{var title=new StringBuilder(512);GetWindowText(h,title,title.Capacity);if(title.ToString().StartsWith("Nexo",StringComparison.OrdinalIgnoreCase)){uint pid;GetWindowThreadProcessId(h,out pid);try{var name=Process.GetProcessById((int)pid).ProcessName;if(name=="msedge"||name=="chrome")found.Add(h);}catch{}}return true;},IntPtr.Zero);return found;}
    static void CloseWindows(){foreach(var h in Windows())PostMessage(h,0x10,IntPtr.Zero,IntPtr.Zero);}
    static string Read(string route,int timeout=1200) { var req=(HttpWebRequest)WebRequest.Create(Url+route);req.Timeout=timeout;req.Proxy=null;using(var r=req.GetResponse())using(var sr=new StreamReader(r.GetResponseStream()))return sr.ReadToEnd(); }
    internal static void Quit() { try { var data=new JavaScriptSerializer().DeserializeObject(Read("/api/session")) as System.Collections.Generic.Dictionary<string,object>;var req=(HttpWebRequest)WebRequest.Create(Url+"/api/quit");req.Proxy=null;req.Timeout=4000;req.Method="POST";req.ContentType="application/json";req.Headers.Add("x-csrf-token",(string)data["csrf"]);byte[] bytes=System.Text.Encoding.UTF8.GetBytes("{}");req.ContentLength=bytes.Length;using(var s=req.GetRequestStream())s.Write(bytes,0,bytes.Length);using(var r=req.GetResponse()){} }catch{} }
    internal static void Open() {var windows=Windows();if(windows.Count>0){ShowWindow(windows[0],9);SetForegroundWindow(windows[0]);return;}var edge=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),@"Microsoft\Edge\Application\msedge.exe");if(!File.Exists(edge))edge=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),@"Microsoft\Edge\Application\msedge.exe");if(File.Exists(edge))Process.Start(new ProcessStartInfo(edge,"--app="+Url+" --window-size=1320,940"){UseShellExecute=true});else Process.Start(new ProcessStartInfo(Url){UseShellExecute=true}); }
    [STAThread] static void Main(string[] args) {
        Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
        if(args.Length>0&&args[0]=="--stop"){Quit();CloseWindows();return;}
        if(Ready()){Open();return;}
        Process server=null;
        var splash=new Form {Text="Nexo",Width=380,Height=170,StartPosition=FormStartPosition.CenterScreen,FormBorderStyle=FormBorderStyle.FixedDialog,MaximizeBox=false,MinimizeBox=false,BackColor=Color.FromArgb(245,246,249)};
        splash.Controls.Add(new Label {Text="Nexo se está abriendo…",Font=new Font("Segoe UI",15,FontStyle.Bold),AutoSize=true,Location=new Point(35,35),ForeColor=Color.FromArgb(69,105,221)});
        try {
            var node=Path.Combine(Root,@"bin\node.exe");var entry=Path.Combine(Root,@"app\server.mjs");
            if(!File.Exists(node)||!File.Exists(entry))throw new Exception("Extraé la carpeta completa del ZIP antes de abrir Nexo.exe. No muevas solo el ejecutable.");
            splash.Show();Application.DoEvents();
            var info=new ProcessStartInfo(node,"--disable-warning=ExperimentalWarning \""+entry+"\""){WorkingDirectory=Path.Combine(Root,"app"),UseShellExecute=false,CreateNoWindow=true,RedirectStandardError=true,RedirectStandardOutput=true};
            info.EnvironmentVariables["HOTEL_DATA_DIR"]=Environment.GetEnvironmentVariable("NEXO_DATA_DIR") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"NexoClientes","Datos");info.EnvironmentVariables["PORT"]="18761";
            server=Process.Start(info);server.ErrorDataReceived+=(s,e)=>{};server.OutputDataReceived+=(s,e)=>{};server.BeginErrorReadLine();server.BeginOutputReadLine();
            bool ready=false;for(int i=0;i<45;i++){Application.DoEvents();if(Ready()){ready=true;break;}if(server.HasExited)break;Thread.Sleep(200);}
            if(!ready)throw new Exception("No se pudo abrir Nexo. Cerrá la versión anterior si sigue abierta y volvé a intentar. El puerto local 18761 debe estar disponible.");
            splash.Close();Open();Application.Run(new TrayContext(server));
        } catch(Exception ex){splash.Close();MessageBox.Show(ex.Message,"Nexo",MessageBoxButtons.OK,MessageBoxIcon.Information);if(server!=null&&!server.HasExited)server.Kill();}
    }
    sealed class TrayContext:ApplicationContext {
        NotifyIcon tray;System.Windows.Forms.Timer timer;
        int fails=0; readonly Process server;
        public TrayContext(Process server){this.server=server;var menu=new ContextMenuStrip();menu.Items.Add("Abrir Nexo",null,(s,e)=>Open());menu.Items.Add("Cerrar Nexo",null,(s,e)=>{Quit();CloseWindows();ExitThread();});tray=new NotifyIcon{Text="Nexo · Clientes",Icon=Icon.ExtractAssociatedIcon(Application.ExecutablePath),Visible=true,ContextMenuStrip=menu};tray.DoubleClick+=(s,e)=>Open();timer=new System.Windows.Forms.Timer{Interval=3000};timer.Tick+=(s,e)=>{if(!Ready(4000)){fails++;if(server.HasExited||fails>=10){CloseWindows();ExitThread();}return;}fails=0;// Closing the app window keeps the local worker and tray alive.
            };timer.Start();}
        protected override void ExitThreadCore(){timer.Stop();tray.Visible=false;tray.Dispose();base.ExitThreadCore();}
    }
}
