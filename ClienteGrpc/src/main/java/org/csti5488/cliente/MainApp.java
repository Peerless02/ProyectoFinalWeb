package org.csti5488.cliente;

import javafx.application.Application;
import javafx.stage.Stage;
import org.csti5488.cliente.service.GrpcClientService;
import org.csti5488.cliente.ui.MainWindow;

public class MainApp extends Application {

    @Override
    public void start(Stage primaryStage) {
        new MainWindow(primaryStage).show();
    }

    @Override
    public void stop() {
        GrpcClientService.getInstance().shutdown();
    }

    public static void main(String[] args) {
        launch(args);
    }
}
