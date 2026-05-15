import Capacitor
import Foundation
import StoreKit

@objc(CriminiBillingPlugin)
public class CriminiBillingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CriminiBillingPlugin"
    public let jsName = "CriminiBilling"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise)
    ]

    private var productsById: [String: Product] = [:]

    @objc func getProducts(_ call: CAPPluginCall) {
        let productIds = call.getArray("productIds", String.self) ?? []

        Task {
            do {
                let products = try await Product.products(for: productIds)
                var responseProducts: [[String: Any]] = []
                var loadedProducts: [String: Product] = [:]

                for product in products {
                    loadedProducts[product.id] = product
                    responseProducts.append([
                        "productId": product.id,
                        "title": product.displayName,
                        "description": product.description,
                        "price": product.displayPrice
                    ])
                }

                self.productsById = loadedProducts
                call.resolve(["products": responseProducts])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId"), !productId.isEmpty else {
            call.reject("Product is required.")
            return
        }

        Task {
            do {
                let product: Product
                if let loaded = self.productsById[productId] {
                    product = loaded
                } else if let fetched = try await Product.products(for: [productId]).first {
                    product = fetched
                } else {
                    call.reject("Product details are not loaded.")
                    return
                }

                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    let transaction = try self.verifiedTransaction(verification)
                    await transaction.finish()
                    call.resolve(self.purchasePayload(transaction))
                case .pending:
                    call.reject("Purchase is pending.")
                case .userCancelled:
                    call.reject("Purchase cancelled.")
                @unknown default:
                    call.reject("Purchase failed.")
                }
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                var purchases: [[String: Any]] = []
                for await entitlement in Transaction.currentEntitlements {
                    if let transaction = try? self.verifiedTransaction(entitlement) {
                        purchases.append(self.purchasePayload(transaction))
                    }
                }
                call.resolve(["purchases": purchases])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    private func verifiedTransaction(_ result: VerificationResult<Transaction>) throws -> Transaction {
        switch result {
        case .verified(let transaction):
            return transaction
        case .unverified(_, let error):
            throw error
        }
    }

    private func purchasePayload(_ transaction: Transaction) -> [String: Any] {
        return [
            "store": "app_store",
            "productId": transaction.productID,
            "originalTransactionId": String(transaction.originalID),
            "transactionId": String(transaction.id)
        ]
    }
}
