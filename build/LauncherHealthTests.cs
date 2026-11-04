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
        var key=new string('a',64);var nonce=new string('b',32);
        var signed="{\"ok\":true,\"app\":\"nexo\",\"proof\":\"195e1b6ac75819d229ffe5f889b5359cd9d5d6ef972945f51aa17e4252f306f3\"}";
        if(!Launcher.IsTrustedHealth(signed,nonce,key))throw new Exception("Valid proof rejected.");
        if(Launcher.IsTrustedHealth(signed,new string('c',32),key))throw new Exception("Replayed proof accepted.");
        if(Launcher.IsTrustedHealth(signed,nonce,new string('c',64)))throw new Exception("Wrong key accepted.");
        if(Launcher.IsTrustedHealth("{\"ok\":true,\"app\":\"nexo\"}",nonce,key))throw new Exception("Unsigned service accepted.");
        if(Launcher.IsTrustedHealth(signed,nonce,""))throw new Exception("Missing installation key accepted.");
        Console.WriteLine("14 launcher health and identity checks passed.");
    }
}
