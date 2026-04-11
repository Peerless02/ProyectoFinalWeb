package org.csti5488.cliente.ui;

import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Scene;
import javafx.scene.control.*;
import javafx.scene.layout.*;
import javafx.scene.paint.Color;
import javafx.scene.shape.Circle;
import javafx.stage.Stage;
import org.csti5488.cliente.service.GrpcClientService;

public class MainWindow {

    private final Stage stage;
    private final TextField hostField  = new TextField("localhost");
    private final TextField portField  = new TextField("9090");
    private final Circle    statusDot  = new Circle(7);
    private final Label     statusLabel = new Label("Sin conectar");

    public MainWindow(Stage stage) {
        this.stage = stage;
        statusDot.setFill(Color.GRAY);
    }

    public void show() {
        // ── Connection bar ──────────────────────────────────────────
        Label hostLbl = new Label("Host:");
        Label portLbl = new Label("Puerto:");
        hostLbl.setStyle("-fx-text-fill: #ecf0f1;");
        portLbl.setStyle("-fx-text-fill: #ecf0f1;");
        statusLabel.setStyle("-fx-text-fill: #ecf0f1;");

        hostField.setPrefWidth(180);
        portField.setPrefWidth(70);

        Button connectBtn = new Button("Conectar");
        connectBtn.setOnAction(e -> handleConnect());

        HBox statusBox = new HBox(6, statusDot, statusLabel);
        statusBox.setAlignment(Pos.CENTER_LEFT);

        HBox connectionBar = new HBox(10, hostLbl, hostField, portLbl, portField, connectBtn, statusBox);
        connectionBar.setAlignment(Pos.CENTER_LEFT);
        connectionBar.setPadding(new Insets(10, 15, 10, 15));
        connectionBar.setStyle("-fx-background-color: #2c3e50;");

        // ── Tabs ────────────────────────────────────────────────────
        TabPane tabPane = new TabPane();
        tabPane.setTabClosingPolicy(TabPane.TabClosingPolicy.UNAVAILABLE);

        Tab tabCrear  = new Tab("Crear Formulario",   new CrearFormularioTab().getRoot());
        Tab tabListar = new Tab("Listar Formularios",  new ListarFormulariosTab().getRoot());
        tabPane.getTabs().addAll(tabCrear, tabListar);

        // ── Root ────────────────────────────────────────────────────
        BorderPane root = new BorderPane();
        root.setTop(connectionBar);
        root.setCenter(tabPane);

        Scene scene = new Scene(root, 900, 660);
        scene.getStylesheets().add(
                getClass().getResource("/styles/app.css").toExternalForm()
        );

        stage.setTitle("Cliente gRPC — Sistema de Encuestas");
        stage.setScene(scene);
        stage.setMinWidth(700);
        stage.setMinHeight(500);
        stage.show();
    }

    private void handleConnect() {
        try {
            String host = hostField.getText().trim();
            int port = Integer.parseInt(portField.getText().trim());
            GrpcClientService.getInstance().connect(host, port);
            statusDot.setFill(Color.LIMEGREEN);
            statusLabel.setText("Conectado a " + host + ":" + port);
        } catch (NumberFormatException ex) {
            statusDot.setFill(Color.RED);
            statusLabel.setText("Puerto inválido");
        }
    }
}
