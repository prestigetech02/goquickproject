import { ProfileSubHeader } from "../../components/ProfileSubHeader";

export function PaymentMethodsPage() {
  return (
    <div className="page profile-page">
      <ProfileSubHeader title="Payment Methods" />
      <section className="card stack">
        <h2 className="profile-card-title">Saved cards</h2>
        <p className="muted">
          Cards you use for wallet top-ups and errand payments are saved securely via Paystack.
          After your first successful payment, they will show up here.
        </p>
        <p className="profile-empty">No saved payment methods yet.</p>
      </section>
    </div>
  );
}
