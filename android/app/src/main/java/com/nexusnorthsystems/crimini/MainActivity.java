package com.nexusnorthsystems.crimini;

import android.content.pm.ApplicationInfo;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
      WebView.setWebContentsDebuggingEnabled(true);
    }
    registerPlugin(CriminiBillingPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
