import { useEffect, useState } from "react";
import { supabase } from "../../config/supabaseClient";

export type User = {
  userId: string | number;
  firstName: string;
  surname: string;
  username: string;
  password: string;
  email: string;
};

const defaultUser: User = {
  userId: "",
  firstName: "",
  surname: "",
  username: "",
  password: "",
  email: "",
};

const EditFields = ({
  user,
}: {
  user: { username: string; userId: string | number };
}) => {
  const [userData, setUserData] = useState(defaultUser);

  const refreshData = async () => {
    const data = await fetchUserInfo(user.userId);
    if (data) {
      setUserData(data);
    }
  };

  useEffect(() => {
    refreshData();
  }, [user.userId]);

  if (!user) {
    return <div className="text-white">Loading user data...</div>;
  }

  return (
    <div className="max-w-xl mx-auto p-6 rounded-xl space-y-6">
      <h2 className="text-2xl font-bold text-white">Edit Profile Fields</h2>

      <EditableField
        label="First Name"
        name="firstName"
        value={userData.firstName}
        username={user.username}
        onUpdate={refreshData}
      />
      <EditableField
        label="Surname"
        name="surname"
        value={userData.surname}
        username={user.username}
        onUpdate={refreshData}
      />
      <EditableField
        label="Username"
        name="username"
        value={userData.username}
        username={user.username}
        onUpdate={refreshData}
      />
      <EditableField
        label="Email"
        name="email"
        value={userData.email}
        username={user.username}
        onUpdate={refreshData}
      />

      <PasswordField username={user.username} onUpdate={refreshData} />
    </div>
  );
};

export default EditFields;

type PasswordFieldProps = {
  username: string;
  onUpdate: () => void;
};

const PasswordField: React.FC<PasswordFieldProps> = ({
  onUpdate,
}) => {
  const [editing, setEditing] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState("");

  const handleSave = async () => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setEditing(false);
      setNewPassword("");
      setStatus("Password updated successfully!");
      onUpdate();
    } catch (err: any) {
      setStatus(err.message || "Update failed.");
    }
  };

  return (
    <div className="flex flex-col gap-1 text-white">
      <label className="font-semibold">Password</label>
      {editing ? (
        <input
          className="p-2 bg-gray-700 rounded focus:outline-none"
          type="password"
          placeholder="New password (min 8 chars)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      ) : (
        <p className="p-2 bg-gray-700 rounded">********</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={editing ? handleSave : () => setEditing(true)}
          className={`px-4 py-1 mt-1 rounded text-white cursor-pointer ${
            editing
              ? "bg-green-600 hover:bg-green-700"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {editing ? "Save" : "Edit"}
        </button>

        {editing && (
          <button
            onClick={() => {
              setEditing(false);
              setNewPassword("");
              setStatus("");
            }}
            className="px-4 py-1 mt-1 rounded bg-red-600 hover:bg-red-700 text-white cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>

      {status && <span className="text-sm text-gray-300">{status}</span>}
    </div>
  );
};

type EditableFieldProps = {
  label: string;
  name: string;
  value: string | undefined;
  username: string;
  onUpdate: () => void;
};

const EditableField: React.FC<EditableFieldProps> = ({
  label,
  name,
  value,
  onUpdate,
}) => {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleSave = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Not authenticated");

      const dbFieldName = name === "firstName" ? "first_name" : name === "surname" ? "surname" : name;

      const { error: dbError } = await supabase
        .from("users")
        .update({ [dbFieldName]: inputValue })
        .eq("user_id", authUser.id);

      if (dbError) throw dbError;

      // Sync auth user metadata
      if (name === "email") {
        const { error: authError } = await supabase.auth.updateUser({ email: inputValue });
        if (authError) throw authError;
      } else if (name === "username") {
        const { error: authError } = await supabase.auth.updateUser({
          data: { username: inputValue },
        });
        if (authError) throw authError;
      } else {
        const metadataName = name === "firstName" ? "first_name" : "surname";
        const { error: authError } = await supabase.auth.updateUser({
          data: { [metadataName]: inputValue },
        });
        if (authError) throw authError;
      }

      setEditing(false);
      setStatus("Updated successfully!");
      onUpdate();
    } catch (err: any) {
      console.error(err);
      setStatus(err.message || "Update failed.");
    }
  };

  return (
    <div className="flex flex-col gap-1 text-white">
      <label className="font-semibold">{label}</label>
      {editing ? (
        <input
          className="p-2 bg-gray-700 rounded focus:outline-none"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
      ) : (
        <p className="p-2 bg-gray-700 rounded">
          {value ? value : "no value exists"}
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={editing ? handleSave : () => setEditing(true)}
          className={`px-4 py-1 mt-1 rounded text-white cursor-pointer ${
            editing
              ? "bg-green-600 hover:bg-green-700"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {editing ? "Save" : "Edit"}
        </button>

        {editing && (
          <button
            onClick={() => {
              setInputValue(value);
              setEditing(false);
              setStatus("");
            }}
            className="px-4 py-1 mt-1 rounded bg-red-600 hover:bg-red-700 text-white cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>

      {status && <span className="text-sm text-gray-300">{status}</span>}
    </div>
  );
};

const fetchUserInfo = async (userId: string | number) => {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) throw error;
    if (data) {
      return {
        userId: data.user_id,
        firstName: data.first_name,
        surname: data.surname,
        username: data.username,
        email: data.email,
        password: "",
      };
    }
  } catch (error) {
    console.error("Failed to fetch user info:", error);
  }
  return null;
};
