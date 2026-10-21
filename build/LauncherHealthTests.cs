using System;
static class LauncherHealthTests {
    static void Check(string response,bool expected) {
        if(Launcher.IsNexoHealth(response)!=expected)throw new Exception("Unexpected health result: "+response);
    }
    static void Main() {
        Check("{\"ok\":true,\"app\":\"nexo\",\"version\":\"3.2.0\"}",true);
        Check("{\"app\": \"nexo\", \"version\": \"3.3.3\", \"ok\": true}",true);
        Check("{\"ok\":true,\"app\":\"nexo\",\"version\":\"4.0.0\"}",true);
        Check("{\"ok\":false,\"app\":\"nexo\"}",false);
        Check("{\"ok\":true,\"app\":\"otra\"}",false);
        Check("{\"app\":\"nexo\"}",false);
        Check("{\"ok\":\"true\",\"app\":\"nexo\"}",false);
        Check("invalid JSON",false);
        Check("null",false);
        Console.WriteLine("9 launcher health checks passed.");
    }
}
