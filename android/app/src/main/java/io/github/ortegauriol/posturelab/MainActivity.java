package io.github.ortegauriol.posturelab;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import androidx.core.view.WindowInsetsControllerCompat;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) {
        if (state == null) PostureLabPlugin.removeInterruptedCaptures(this);
        registerPlugin(PostureLabPlugin.class);
        super.onCreate(state);
        new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView()).setAppearanceLightNavigationBars(false);
    }
}
