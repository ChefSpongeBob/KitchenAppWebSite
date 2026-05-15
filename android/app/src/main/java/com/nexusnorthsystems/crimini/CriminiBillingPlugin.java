package com.nexusnorthsystems.crimini;

import androidx.annotation.NonNull;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "CriminiBilling")
public class CriminiBillingPlugin extends Plugin implements PurchasesUpdatedListener {
  private BillingClient billingClient;
  private PluginCall pendingPurchaseCall;
  private final Map<String, ProductDetails> productDetailsById = new HashMap<>();

  @Override
  public void load() {
    billingClient = BillingClient.newBuilder(getContext())
      .enablePendingPurchases(
        PendingPurchasesParams.newBuilder()
          .enableOneTimeProducts()
          .enablePrepaidPlans()
          .build()
      )
      .setListener(this)
      .build();
  }

  @PluginMethod
  public void getProducts(PluginCall call) {
    JSArray ids = call.getArray("productIds", new JSArray());
    List<QueryProductDetailsParams.Product> products = new ArrayList<>();
    for (int index = 0; index < ids.length(); index++) {
      String productId = ids.optString(index, "");
      if (!productId.isEmpty()) {
        products.add(
          QueryProductDetailsParams.Product.newBuilder()
            .setProductId(productId)
            .setProductType(BillingClient.ProductType.SUBS)
            .build()
        );
      }
    }

    if (products.isEmpty()) {
      JSObject result = new JSObject();
      result.put("products", new JSArray());
      call.resolve(result);
      return;
    }

    withBillingConnection(call, () -> {
      QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
        .setProductList(products)
        .build();

      billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsResult) -> {
        if (!isOk(billingResult)) {
          call.reject(billingResult.getDebugMessage());
          return;
        }

        JSArray responseProducts = new JSArray();
        productDetailsById.clear();
        List<ProductDetails> detailsList = productDetailsResult.getProductDetailsList();
        for (ProductDetails details : detailsList) {
          productDetailsById.put(details.getProductId(), details);
          JSObject item = new JSObject();
          item.put("productId", details.getProductId());
          item.put("title", details.getTitle());
          item.put("description", details.getDescription());

          List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
          if (offers != null && !offers.isEmpty()) {
            List<ProductDetails.PricingPhase> phases = offers.get(0).getPricingPhases().getPricingPhaseList();
            if (!phases.isEmpty()) {
              ProductDetails.PricingPhase phase = phases.get(0);
              item.put("price", phase.getFormattedPrice());
              item.put("currencyCode", phase.getPriceCurrencyCode());
            }
          }
          responseProducts.put(item);
        }

        JSObject result = new JSObject();
        result.put("products", responseProducts);
        call.resolve(result);
      });
    });
  }

  @PluginMethod
  public void purchase(PluginCall call) {
    String productId = call.getString("productId", "");
    if (productId.isEmpty()) {
      call.reject("Product is required.");
      return;
    }

    withBillingConnection(call, () -> {
      ProductDetails details = productDetailsById.get(productId);
      if (details == null) {
        call.reject("Product details are not loaded.");
        return;
      }

      List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
      if (offers == null || offers.isEmpty()) {
        call.reject("No subscription offer is available.");
        return;
      }

      BillingFlowParams.ProductDetailsParams productDetailsParams =
        BillingFlowParams.ProductDetailsParams.newBuilder()
          .setProductDetails(details)
          .setOfferToken(offers.get(0).getOfferToken())
          .build();

      pendingPurchaseCall = call;
      List<BillingFlowParams.ProductDetailsParams> flowProducts = new ArrayList<>();
      flowProducts.add(productDetailsParams);
      BillingFlowParams params = BillingFlowParams.newBuilder()
        .setProductDetailsParamsList(flowProducts)
        .build();
      BillingResult billingResult = billingClient.launchBillingFlow(getActivity(), params);
      if (!isOk(billingResult)) {
        pendingPurchaseCall = null;
        call.reject(billingResult.getDebugMessage());
      }
    });
  }

  @PluginMethod
  public void restorePurchases(PluginCall call) {
    withBillingConnection(call, () -> {
      QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
        .setProductType(BillingClient.ProductType.SUBS)
        .build();
      billingClient.queryPurchasesAsync(params, (billingResult, purchases) -> {
        if (!isOk(billingResult)) {
          call.reject(billingResult.getDebugMessage());
          return;
        }

        JSArray restored = new JSArray();
        for (Purchase purchase : purchases) {
          restored.put(toPurchasePayload(purchase));
        }
        JSObject result = new JSObject();
        result.put("purchases", restored);
        call.resolve(result);
      });
    });
  }

  @Override
  public void onPurchasesUpdated(@NonNull BillingResult billingResult, List<Purchase> purchases) {
    if (pendingPurchaseCall == null) return;
    PluginCall call = pendingPurchaseCall;
    pendingPurchaseCall = null;

    if (!isOk(billingResult)) {
      call.reject(billingResult.getDebugMessage());
      return;
    }
    if (purchases == null || purchases.isEmpty()) {
      call.reject("No purchase returned.");
      return;
    }

    Purchase purchase = purchases.get(0);
    if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) {
      call.reject("Purchase is pending.");
      return;
    }

    call.resolve(toPurchasePayload(purchase));
  }

  private void withBillingConnection(PluginCall call, Runnable action) {
    if (billingClient.isReady()) {
      action.run();
      return;
    }

    billingClient.startConnection(new BillingClientStateListener() {
      @Override
      public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
        if (!isOk(billingResult)) {
          call.reject(billingResult.getDebugMessage());
          return;
        }
        action.run();
      }

      @Override
      public void onBillingServiceDisconnected() {}
    });
  }

  private boolean isOk(BillingResult billingResult) {
    return billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK;
  }

  private JSObject toPurchasePayload(Purchase purchase) {
    JSObject result = new JSObject();
    String productId = purchase.getProducts().isEmpty() ? "" : purchase.getProducts().get(0);
    result.put("store", "google_play");
    result.put("productId", productId);
    result.put("purchaseToken", purchase.getPurchaseToken());
    result.put("transactionId", purchase.getOrderId());
    return result;
  }
}
