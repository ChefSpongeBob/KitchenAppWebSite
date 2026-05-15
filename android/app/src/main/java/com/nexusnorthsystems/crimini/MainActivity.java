package com.nexusnorthsystems.crimini;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(CriminiBillingPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
