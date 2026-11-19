package io.github.ortegauriol.posturelab;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) {
        registerPlugin(PostureLabPlugin.class);
        super.onCreate(state);
    }
}
